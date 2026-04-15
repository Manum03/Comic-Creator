from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

class TextBubble(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    x: float
    y: float
    width: float
    height: float
    style: str = "speech"

class ComicPanel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    position: int
    canvasData: Optional[str] = None
    improvedImageUrl: Optional[str] = None
    textBubbles: List[TextBubble] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ComicProject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "Mi Historieta"
    panels: List[ComicPanel] = []
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ImproveDrawingRequest(BaseModel):
    canvasData: str
    prompt: Optional[str] = "Improve and enhance this comic drawing, make it more detailed and professional while keeping the same composition and style"

class ImproveDrawingResponse(BaseModel):
    improvedImage: str
    message: str

class ProjectCreateRequest(BaseModel):
    title: Optional[str] = "Mi Historieta"

class ProjectUpdateRequest(BaseModel):
    title: Optional[str] = None
    panels: Optional[List[ComicPanel]] = None

@api_router.get("/")
async def root():
    return {"message": "ComicAI API"}

@api_router.post("/panels/improve", response_model=ImproveDrawingResponse)
async def improve_drawing(request: ImproveDrawingRequest):
    try:
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        canvas_base64 = request.canvasData.split(',')[1] if ',' in request.canvasData else request.canvasData
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"comic-improve-{uuid.uuid4()}",
            system_message="You are a professional comic artist assistant that enhances sketches and drawings."
        )
        
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(
            text=request.prompt,
            file_contents=[ImageContent(canvas_base64)]
        )
        
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        if not images or len(images) == 0:
            raise HTTPException(status_code=500, detail="No image generated")
        
        improved_image_base64 = f"data:image/png;base64,{images[0]['data']}"
        
        return ImproveDrawingResponse(
            improvedImage=improved_image_base64,
            message="Drawing improved successfully"
        )
    except Exception as e:
        logging.error(f"Error improving drawing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error improving drawing: {str(e)}")

@api_router.post("/projects", response_model=ComicProject)
async def create_project(request: ProjectCreateRequest):
    try:
        project = ComicProject(title=request.title)
        doc = project.model_dump()
        doc['createdAt'] = doc['createdAt'].isoformat()
        doc['updatedAt'] = doc['updatedAt'].isoformat()
        doc['panels'] = []
        
        await db.comic_projects.insert_one(doc)
        return project
    except Exception as e:
        logging.error(f"Error creating project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/projects", response_model=List[ComicProject])
async def get_projects():
    try:
        projects = await db.comic_projects.find({}, {"_id": 0}).to_list(100)
        for project in projects:
            if isinstance(project.get('createdAt'), str):
                project['createdAt'] = datetime.fromisoformat(project['createdAt'])
            if isinstance(project.get('updatedAt'), str):
                project['updatedAt'] = datetime.fromisoformat(project['updatedAt'])
            for panel in project.get('panels', []):
                if isinstance(panel.get('timestamp'), str):
                    panel['timestamp'] = datetime.fromisoformat(panel['timestamp'])
        return projects
    except Exception as e:
        logging.error(f"Error getting projects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/projects/{project_id}", response_model=ComicProject)
async def get_project(project_id: str):
    try:
        project = await db.comic_projects.find_one({"id": project_id}, {"_id": 0})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        if isinstance(project.get('createdAt'), str):
            project['createdAt'] = datetime.fromisoformat(project['createdAt'])
        if isinstance(project.get('updatedAt'), str):
            project['updatedAt'] = datetime.fromisoformat(project['updatedAt'])
        for panel in project.get('panels', []):
            if isinstance(panel.get('timestamp'), str):
                panel['timestamp'] = datetime.fromisoformat(panel['timestamp'])
        
        return project
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/projects/{project_id}", response_model=ComicProject)
async def update_project(project_id: str, request: ProjectUpdateRequest):
    try:
        project = await db.comic_projects.find_one({"id": project_id}, {"_id": 0})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        update_data = {}
        if request.title is not None:
            update_data['title'] = request.title
        if request.panels is not None:
            panels_data = []
            for panel in request.panels:
                panel_dict = panel.model_dump()
                panel_dict['timestamp'] = panel_dict['timestamp'].isoformat()
                panels_data.append(panel_dict)
            update_data['panels'] = panels_data
        
        update_data['updatedAt'] = datetime.now(timezone.utc).isoformat()
        
        await db.comic_projects.update_one(
            {"id": project_id},
            {"$set": update_data}
        )
        
        updated_project = await db.comic_projects.find_one({"id": project_id}, {"_id": 0})
        if isinstance(updated_project.get('createdAt'), str):
            updated_project['createdAt'] = datetime.fromisoformat(updated_project['createdAt'])
        if isinstance(updated_project.get('updatedAt'), str):
            updated_project['updatedAt'] = datetime.fromisoformat(updated_project['updatedAt'])
        for panel in updated_project.get('panels', []):
            if isinstance(panel.get('timestamp'), str):
                panel['timestamp'] = datetime.fromisoformat(panel['timestamp'])
        
        return updated_project
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()