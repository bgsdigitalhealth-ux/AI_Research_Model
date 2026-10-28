import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { protocolsApi } from '@/api/protocolsApi';
import { useToast } from '@/components/ui/use-toast';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  FileCheck,
  RotateCcw
} from 'lucide-react';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProtocolUploadView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0');
  const [studyId, setStudyId] = useState('');
  const [irbNumber, setIrbNumber] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Upload tracking state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validateFile = (file: File): string | null => {
    const isExtensionValid = ALLOWED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);

    if (!isExtensionValid && !isMimeValid) {
      return 'Invalid file type. Only standard research PDF (.pdf) and Word (.docx) protocol files are accepted.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File size (${formatBytes(file.size)}) exceeds the maximum allowed limit of ${formatBytes(MAX_FILE_SIZE_BYTES)}.`;
    }

    return null;
  };

  const handleFileSelection = (file: File) => {
    setErrorMessage(null);
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    // Autofill title from file name if empty
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadPercentage(0);
    setProcessingStatus('Upload cancelled by user.');
    toast({
      title: 'Upload Cancelled',
      description: 'The file upload transmission was halted.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please choose or drop a protocol file to upload.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Protocol title is required.');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setUploadPercentage(0);
    setBytesUploaded(0);
    setTotalBytes(selectedFile.size);
    setProcessingStatus('Uploading protocol document...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title.trim());
    formData.append('version', version.trim() || '1.0');
    if (studyId.trim()) formData.append('studyId', studyId.trim());
    if (irbNumber.trim()) formData.append('irbApprovalNumber', irbNumber.trim());

    try {
      const uploadedProtocol = await protocolsApi.uploadProtocol(formData, {
        signal: controller.signal,
        onProgress: (progress) => {
          setUploadPercentage(progress.percentage);
          setBytesUploaded(progress.loaded);
          if (progress.total) setTotalBytes(progress.total);
          if (progress.percentage === 100) {
            setProcessingStatus('Upload complete. Waiting for backend server intake confirmation...');
          }
        },
      });

      // Backend confirmed receipt!
      setIsUploading(false);
      setProcessingStatus('Protocol successfully registered on backend.');
      toast({
        title: 'Protocol Uploaded',
        description: `Protocol "${uploadedProtocol.title}" has been saved.`,
        variant: 'success',
      });

      // Navigate to Document & Metadata or Verification workspace
      navigate(`/protocols/${uploadedProtocol.id}`);
    } catch (err: unknown) {
      setIsUploading(false);
      const isAborted = (err as { name?: string })?.name === 'CanceledError';
      if (!isAborted) {
        const errorMsg =
          (err as { message?: string })?.message ||
          'Failed to upload protocol. Please verify backend endpoint (/protocols/upload) connectivity.';
        setErrorMessage(errorMsg);
        setProcessingStatus(null);
      }
    }
  };

  return (
    <PageContainer
      title="Upload Research Protocol"
      description="Submit clinical protocol documents (.pdf, .docx) for document archiving and automated parameter extraction."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Protocols', path: '/protocols' },
        { label: 'Upload', isCurrent: true },
      ]}
      actions={
        <Link to="/protocols">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span>Cancel</span>
          </Button>
        </Link>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-6 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900">
              Protocol Document Submission
            </CardTitle>
            <p className="text-xs text-slate-500">
              Accepts PDF and DOCX files up to 50MB. Real network transmission is monitored.
            </p>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Upload Error</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/50'
                    : selectedFile
                    ? 'border-emerald-300 bg-emerald-50/20'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelection(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <FileCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatBytes(selectedFile.size)} · {selectedFile.type || 'Document'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setUploadPercentage(0);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Remove File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Drag and drop your protocol file here, or browse
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supports PDF and DOCX formats (up to 50MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Protocol Metadata Form */}
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Protocol Title *
                  </label>
                  <Input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Phase III Randomized Evaluation of Targeted Inhibitors"
                    disabled={isUploading}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Version *
                    </label>
                    <Input
                      required
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0"
                      disabled={isUploading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      IRB / Ethics Approval #
                    </label>
                    <Input
                      value={irbNumber}
                      onChange={(e) => setIrbNumber(e.target.value)}
                      placeholder="IRB-2026-X01"
                      disabled={isUploading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Associated Study ID
                    </label>
                    <Input
                      value={studyId}
                      onChange={(e) => setStudyId(e.target.value)}
                      placeholder="STUDY-001 (Optional)"
                      disabled={isUploading}
                    />
                  </div>
                </div>
              </div>

              {/* Progress and Live Status Bar */}
              {isUploading && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                      {processingStatus || 'Uploading...'}
                    </span>
                    <span className="font-mono font-bold text-blue-800">
                      {uploadPercentage}%
                    </span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full h-2 rounded-full bg-blue-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-150"
                      style={{ width: `${uploadPercentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-blue-700">
                    <span>
                      {formatBytes(bytesUploaded)} of {formatBytes(totalBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelUpload}
                      className="text-red-600 hover:text-red-800 font-semibold underline"
                    >
                      Cancel Upload
                    </button>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Link to="/protocols">
                  <Button type="button" variant="outline" size="sm" disabled={isUploading}>
                    Cancel
                  </Button>
                </Link>

                <Button
                  type="submit"
                  size="sm"
                  disabled={!selectedFile || isUploading}
                  className="gap-1.5"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Start Upload & Processing</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

