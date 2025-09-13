import React, { useRef, useState } from 'react';
import { Camera, Loader2, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MediaKit } from './mediakit';
import { COLORS } from './index';

interface ProfileSectionProps {
  mediaKit: MediaKit;
  isEditing: boolean;
  onImageChange: (imageUrl: string) => void;
  onFieldChange: (field: keyof MediaKit, value: any) => void;
  validationErrors: string[];
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  mediaKit,
  isEditing,
  onImageChange,
  onFieldChange,
  validationErrors,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const imageUrl = URL.createObjectURL(file);
      onImageChange(imageUrl);
    } catch (error) {
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      {/* Hero Background */}
      <div className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} h-40 rounded-t-2xl relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/5" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Profile Content */}
      <div className="bg-white rounded-b-2xl px-8 pb-8 -mt-16 relative">
        <div className="flex flex-col lg:flex-row items-start lg:items-end gap-8 pt-6">
          {/* Profile Image */}
          <div className="relative group">
            <Avatar className="w-40 h-40 border-4 border-white shadow-xl ring-4 ring-gray-50">
              <AvatarImage 
                src={mediaKit.profileImage} 
                alt={mediaKit.name} 
                className="object-cover"
              />
              <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600">
                {mediaKit.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {isEditing && (
              <>
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full transition-all duration-300 flex items-center justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/95 hover:bg-white text-gray-800 shadow-lg font-medium"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {!isUploading && <span className="ml-2">Update</span>}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1 space-y-6 w-full pt-6">
            {isEditing ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={mediaKit.name}
                    onChange={(e) => onFieldChange('name', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all text-lg font-medium"
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bio & Description *
                  </label>
                  <textarea
                    value={mediaKit.bio}
                    onChange={(e) => onFieldChange('bio', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all resize-none"
                    placeholder="Tell your story, describe your content style, and what makes you unique..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Content Categories
                  </label>
                  <input
                    type="text"
                    value={mediaKit.categories.join(', ')}
                    onChange={(e) => onFieldChange('categories', e.target.value.split(',').map(c => c.trim()))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                    placeholder="Fashion, Lifestyle, Travel, Food, Tech..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2 leading-tight">
                    {mediaKit.name}
                  </h1>
                  <p className="text-lg text-gray-600 leading-relaxed font-medium">
                    @{mediaKit.platformName}
                  </p>
                </div>
                
                <p className="text-lg text-gray-700 leading-relaxed max-w-3xl">
                  {mediaKit.bio}
                </p>
                
                {mediaKit.categories.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {mediaKit.categories.map((category) => (
                      <Badge
                        key={category}
                        className="bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-4 py-2 text-sm font-semibold rounded-full hover:shadow-md transition-all"
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};