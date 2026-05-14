import requests
import sys
import json
import base64
from datetime import datetime
from io import BytesIO
from PIL import Image, ImageDraw

class ComicAPITester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.project_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_test_canvas_data(self):
        """Create a simple test canvas image as base64"""
        # Create a simple test image
        img = Image.new('RGB', (800, 600), color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw a simple comic-style drawing
        draw.rectangle([100, 100, 300, 200], outline='black', width=3)
        draw.ellipse([150, 130, 180, 160], fill='black')  # Eye
        draw.ellipse([220, 130, 250, 160], fill='black')  # Eye
        draw.arc([150, 170, 250, 190], 0, 180, fill='black', width=2)  # Smile
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_create_project(self):
        """Test creating a new comic project"""
        success, response = self.run_test(
            "Create Project",
            "POST",
            "projects",
            200,
            data={"title": "Test Comic Project"}
        )
        if success and 'id' in response:
            self.project_id = response['id']
            print(f"   Created project with ID: {self.project_id}")
            return True
        return False

    def test_get_projects(self):
        """Test getting all projects"""
        success, response = self.run_test(
            "Get All Projects",
            "GET",
            "projects",
            200
        )
        if success:
            print(f"   Found {len(response)} projects")
        return success

    def test_get_project_by_id(self):
        """Test getting a specific project by ID"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Project by ID",
            "GET",
            f"projects/{self.project_id}",
            200
        )
        return success

    def test_update_project(self):
        """Test updating a project"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False

        # Create test panel data
        test_panel = {
            "id": "test-panel-1",
            "position": 0,
            "canvasData": self.create_test_canvas_data(),
            "improvedImageUrl": None,
            "textBubbles": [
                {
                    "id": "bubble-1",
                    "text": "Hello World!",
                    "x": 100,
                    "y": 100,
                    "width": 150,
                    "height": 80,
                    "style": "speech"
                }
            ],
            "timestamp": datetime.now().isoformat()
        }

        success, response = self.run_test(
            "Update Project",
            "PUT",
            f"projects/{self.project_id}",
            200,
            data={
                "title": "Updated Test Comic",
                "panels": [test_panel]
            }
        )
        return success

    def test_improve_drawing(self):
        """Test AI drawing improvement"""
        canvas_data = self.create_test_canvas_data()
        
        success, response = self.run_test(
            "Improve Drawing with AI",
            "POST",
            "panels/improve",
            200,
            data={
                "canvasData": canvas_data,
                "prompt": "Improve this comic drawing, make it more detailed and professional"
            }
        )
        
        if success:
            if 'improvedImage' in response and response['improvedImage']:
                print("   ✅ AI improvement returned enhanced image")
                return True
            else:
                print("   ❌ AI improvement did not return enhanced image")
                return False
        return False

    def test_improve_drawing_without_prompt(self):
        """Test AI drawing improvement with default prompt"""
        canvas_data = self.create_test_canvas_data()
        
        success, response = self.run_test(
            "Improve Drawing (Default Prompt)",
            "POST",
            "panels/improve",
            200,
            data={"canvasData": canvas_data}
        )
        return success

    def test_invalid_project_id(self):
        """Test getting non-existent project"""
        success, response = self.run_test(
            "Get Non-existent Project",
            "GET",
            "projects/invalid-id-12345",
            404
        )
        return success

    def test_invalid_canvas_data(self):
        """Test AI improvement with invalid canvas data"""
        success, response = self.run_test(
            "Improve Drawing (Invalid Data)",
            "POST",
            "panels/improve",
            500,
            data={"canvasData": "invalid-base64-data"}
        )
        return success

def main():
    print("🚀 Starting Comic API Tests...")
    print("=" * 50)
    
    tester = ComicAPITester()
    
    # Test basic connectivity
    if not tester.test_root_endpoint():
        print("❌ Root endpoint failed, stopping tests")
        return 1

    # Test project management
    if not tester.test_create_project():
        print("❌ Project creation failed, stopping tests")
        return 1

    tester.test_get_projects()
    tester.test_get_project_by_id()
    tester.test_update_project()

    # Test AI improvement
    print("\n🤖 Testing AI Enhancement...")
    tester.test_improve_drawing()
    tester.test_improve_drawing_without_prompt()

    # Test error cases
    print("\n🔍 Testing Error Cases...")
    tester.test_invalid_project_id()
    tester.test_invalid_canvas_data()

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
