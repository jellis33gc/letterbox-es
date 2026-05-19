from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import databutton as db
import uuid
from datetime import datetime

router = APIRouter(prefix="/locations")

# --- Models ---

class Location(BaseModel):
    id: str
    name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    zip_code: str
    country: str
    created_at: str
    updated_at: str

class LocationCreate(BaseModel):
    name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    zip_code: str
    country: str

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None

# --- Storage Helper ---

LOCATIONS_KEY = "all_locations"

def get_all_locations() -> List[dict]:
    return db.storage.json.get(LOCATIONS_KEY, default=[])

def save_all_locations(locations: List[dict]):
    db.storage.json.put(LOCATIONS_KEY, locations)

# --- Endpoints ---

@router.get("/", response_model=List[Location])
def list_locations():
    """List all available locations."""
    locations = get_all_locations()
    # Sort by name for display
    return sorted(locations, key=lambda x: x.get("name", ""))

@router.post("/", response_model=Location)
def create_location(location_in: LocationCreate):
    """Create a new location."""
    locations = get_all_locations()
    
    # Check for duplicate names (case-insensitive)
    if any(loc["name"].lower() == location_in.name.lower() for loc in locations):
        raise HTTPException(status_code=400, detail="A location with this name already exists.")

    new_id = f"loc_{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()
    
    new_location = {
        "id": new_id,
        **location_in.dict(),
        "created_at": now,
        "updated_at": now
    }
    
    locations.append(new_location)
    save_all_locations(locations)
    
    return new_location

@router.get("/{location_id}", response_model=Location)
def get_location(location_id: str):
    """Get a specific location by ID."""
    locations = get_all_locations()
    location = next((loc for loc in locations if loc["id"] == location_id), None)
    
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
        
    return location

@router.put("/{location_id}", response_model=Location)
def update_location(location_id: str, location_in: LocationUpdate):
    """Update an existing location."""
    locations = get_all_locations()
    
    # Find index
    index = next((i for i, loc in enumerate(locations) if loc["id"] == location_id), -1)
    
    if index == -1:
        raise HTTPException(status_code=404, detail="Location not found")
    
    current_location = locations[index]
    update_data = location_in.dict(exclude_unset=True)
    
    # check name uniqueness if name is being updated
    if "name" in update_data:
        new_name = update_data["name"]
        if any(loc["name"].lower() == new_name.lower() and loc["id"] != location_id for loc in locations):
            raise HTTPException(status_code=400, detail="A location with this name already exists.")
            
    updated_location = {
        **current_location,
        **update_data,
        "updated_at": datetime.now().isoformat()
    }
    
    locations[index] = updated_location
    save_all_locations(locations)
    
    return updated_location

@router.delete("/{location_id}")
def delete_location(location_id: str):
    """Delete a location."""
    locations = get_all_locations()
    
    # Check if location exists
    if not any(loc["id"] == location_id for loc in locations):
        raise HTTPException(status_code=404, detail="Location not found")
    
    # Filter out the deleted location
    new_locations = [loc for loc in locations if loc["id"] != location_id]
    save_all_locations(new_locations)
    
    return {"success": True, "message": "Location deleted successfully"}
