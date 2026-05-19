import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import apiClient from "@/apiclient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, Edit, Trash2, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Location {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  zip_code: string;
  country: string;
  created_at: string;
  updated_at: string;
}

interface LocationFormData {
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

const initialFormState: LocationFormData = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip_code: "",
  country: "Spain"
};

export default function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState<LocationFormData>(initialFormState);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.list_locations();
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error("Failed to fetch locations:", error);
      toast.error("Failed to load locations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address_line1 || !formData.city || !formData.zip_code || !formData.country) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.create_location(formData);
      
      if (response.ok) {
        toast.success("Location created successfully");
        setIsCreateDialogOpen(false);
        setFormData(initialFormState);
        fetchLocations();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to create location");
      }
    } catch (error) {
      console.error("Error creating location:", error);
      toast.error("An error occurred while creating the location");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return;
    
    if (!formData.name || !formData.address_line1 || !formData.city || !formData.zip_code || !formData.country) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.update_location(
        { locationId: selectedLocation.id },
        formData
      );
      
      if (response.ok) {
        toast.success("Location updated successfully");
        setIsEditDialogOpen(false);
        setSelectedLocation(null);
        setFormData(initialFormState);
        fetchLocations();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to update location");
      }
    } catch (error) {
      console.error("Error updating location:", error);
      toast.error("An error occurred while updating the location");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!selectedLocation) return;

    try {
      setIsSubmitting(true);
      const response = await apiClient.delete_location({ locationId: selectedLocation.id });
      
      if (response.ok) {
        toast.success("Location deleted successfully");
        setIsDeleteDialogOpen(false);
        setSelectedLocation(null);
        fetchLocations();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to delete location");
      }
    } catch (error) {
      console.error("Error deleting location:", error);
      toast.error("An error occurred while deleting the location");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (location: Location) => {
    setSelectedLocation(location);
    setFormData({
      name: location.name,
      address_line1: location.address_line1,
      address_line2: location.address_line2 || "",
      city: location.city,
      state: location.state || "",
      zip_code: location.zip_code,
      country: location.country
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (location: Location) => {
    setSelectedLocation(location);
    setIsDeleteDialogOpen(true);
  };

  const filteredLocations = locations.filter(loc => 
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Locations</h2>
          <p className="text-muted-foreground">Manage physical locations where mail is received.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black text-white hover:bg-gray-800">
              <Plus className="mr-2 h-4 w-4" /> Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>
                Add a new physical location for mail reception.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLocation} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Location Name *</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Gran Canaria HQ" 
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address1">Address Line 1 *</Label>
                <Input 
                  id="address1" 
                  value={formData.address_line1} 
                  onChange={(e) => setFormData({...formData, address_line1: e.target.value})} 
                  placeholder="Street address" 
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address2">Address Line 2</Label>
                <Input 
                  id="address2" 
                  value={formData.address_line2} 
                  onChange={(e) => setFormData({...formData, address_line2: e.target.value})} 
                  placeholder="Apartment, suite, unit, etc." 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City *</Label>
                  <Input 
                    id="city" 
                    value={formData.city} 
                    onChange={(e) => setFormData({...formData, city: e.target.value})} 
                    placeholder="City" 
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zip">Zip / Postal Code *</Label>
                  <Input 
                    id="zip" 
                    value={formData.zip_code} 
                    onChange={(e) => setFormData({...formData, zip_code: e.target.value})} 
                    placeholder="Postal Code" 
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="state">State / Province</Label>
                  <Input 
                    id="state" 
                    value={formData.state} 
                    onChange={(e) => setFormData({...formData, state: e.target.value})} 
                    placeholder="State" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input 
                    id="country" 
                    value={formData.country} 
                    onChange={(e) => setFormData({...formData, country: e.target.value})} 
                    placeholder="Country" 
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create Location
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>All Locations</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No locations found. Add one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City / Zip</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {location.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {location.address_line1}
                      {location.address_line2 && <span className="text-muted-foreground">, {location.address_line2}</span>}
                    </TableCell>
                    <TableCell>{location.city}, {location.zip_code}</TableCell>
                    <TableCell>{location.country}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(location)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(location)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>
              Update location details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateLocation} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Location Name *</Label>
                <Input 
                  id="edit-name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-address1">Address Line 1 *</Label>
                <Input 
                  id="edit-address1" 
                  value={formData.address_line1} 
                  onChange={(e) => setFormData({...formData, address_line1: e.target.value})} 
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-address2">Address Line 2</Label>
                <Input 
                  id="edit-address2" 
                  value={formData.address_line2} 
                  onChange={(e) => setFormData({...formData, address_line2: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-city">City *</Label>
                  <Input 
                    id="edit-city" 
                    value={formData.city} 
                    onChange={(e) => setFormData({...formData, city: e.target.value})} 
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-zip">Zip / Postal Code *</Label>
                  <Input 
                    id="edit-zip" 
                    value={formData.zip_code} 
                    onChange={(e) => setFormData({...formData, zip_code: e.target.value})} 
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-state">State / Province</Label>
                  <Input 
                    id="edit-state" 
                    value={formData.state} 
                    onChange={(e) => setFormData({...formData, state: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-country">Country *</Label>
                  <Input 
                    id="edit-country" 
                    value={formData.country} 
                    onChange={(e) => setFormData({...formData, country: e.target.value})} 
                    required
                  />
                </div>
              </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this location? This action cannot be undone.
              Existing customers linked to this location might be affected.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedLocation && (
              <div className="bg-muted p-4 rounded-md">
                <p className="font-medium">{selectedLocation.name}</p>
                <p className="text-sm text-muted-foreground">{selectedLocation.address_line1}, {selectedLocation.city}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteLocation} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
