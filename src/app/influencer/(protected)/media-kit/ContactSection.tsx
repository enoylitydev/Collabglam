
// -----------------------------------------------------------------------------
// ContactSection.tsx — v2 (adds Phone; safer URL handling)
// -----------------------------------------------------------------------------

import React from 'react';
import { Mail, Globe, Download, ExternalLink, Info, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { MediaKit } from './mediakit';
import { COLORS } from './index';

interface ContactSectionProps {
  mediaKit: MediaKit;
  isEditing: boolean;
  onFieldChange: (field: keyof MediaKit, value: any) => void;
}

const withHttp = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export const ContactSection: React.FC<ContactSectionProps> = ({ mediaKit, isEditing, onFieldChange }) => {
  const hasAnyContact = Boolean(mediaKit?.email) || Boolean((mediaKit as any)?.phone) || Boolean(mediaKit?.website) || Boolean(mediaKit?.mediaKitPdf);

  return (
    <Card className="shadow-xl border-0 bg-gradient-to-r from-white to-gray-50">
      <CardContent className="p-6 sm:p-8">
        {isEditing ? (
          <div className="space-y-6">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4" />Email Address
                </label>
                <input
                  type="email"
                  value={mediaKit.email || ''}
                  onChange={(e) => onFieldChange('email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                  placeholder="your.email@example.com"
                  inputMode="email"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="h-4 w-4" />Phone
                </label>
                <input
                  type="tel"
                  value={(mediaKit as any).phone || ''}
                  onChange={(e) => (onFieldChange as any)('phone' as any, e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                  placeholder="+91 98765 43210"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4" />Website URL
                </label>
                <input
                  type="url"
                  value={mediaKit.website || ''}
                  onChange={(e) => onFieldChange('website', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                  placeholder="https://yourwebsite.com"
                  inputMode="url"
                  autoComplete="url"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Download className="h-4 w-4" />Media Kit PDF (URL)
                </label>
                <input
                  type="url"
                  value={mediaKit.mediaKitPdf || ''}
                  onChange={(e) => onFieldChange('mediaKitPdf', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                  placeholder="https://example.com/media-kit.pdf"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Paste a public link to your PDF. If it’s a relative path (e.g. <code>/uploads/kit.pdf</code>), make sure your server serves it.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-6">
            {!hasAnyContact ? (
              <div className="w-full flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-6 text-gray-600">
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5" />
                  <span className="text-sm sm:text-base">No contact details added yet.</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                  {(mediaKit as any).phone && (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto gap-2 shadow-md font-semibold border-2 hover:bg-gray-50"
                    >
                      <a href={`tel:${(mediaKit as any).phone}`} aria-label="Call the influencer">
                        <Phone className="h-5 w-5" /> Call
                      </a>
                    </Button>
                  )}

                  {mediaKit.email && (
                    <Button
                      asChild
                      size="lg"
                      className={`w-full sm:w-auto bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} text-gray-800 hover:from-[#E6AC00] hover:to-[#E6C247] gap-2 shadow-lg font-semibold`}
                    >
                      <a href={`mailto:${mediaKit.email}`} aria-label="Email the influencer">
                        <Mail className="h-5 w-5" />Get In Touch
                      </a>
                    </Button>
                  )}

                  {mediaKit.mediaKitPdf && (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto gap-2 shadow-md font-semibold border-2 hover:bg-gray-50"
                    >
                      <a href={mediaKit.mediaKitPdf} target="_blank" rel="noopener noreferrer" aria-label="Download media kit PDF">
                        <Download className="h-5 w-5" />Download PDF
                      </a>
                    </Button>
                  )}
                </div>

                {mediaKit.website && (
                  <Button
                    asChild
                    variant="ghost"
                    size="lg"
                    className="w-full sm:w-auto text-gray-600 hover:text-gray-800 gap-2 font-medium justify-center"
                  >
                    <a href={withHttp(mediaKit.website)} target="_blank" rel="noopener noreferrer" aria-label="Visit website">
                      <ExternalLink className="h-4 w-4" />Visit Website
                    </a>
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
