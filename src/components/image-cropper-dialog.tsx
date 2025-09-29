
"use client";

import { useState, useRef } from "react";
import ReactCrop, { type Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "./ui/slider";

interface ImageCropperDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  imgSrc: string;
  onCropped: (image: Blob | null) => void;
}

function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.resolve(null);
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg');
  });
}


export default function ImageCropperDialog({ isOpen, setIsOpen, imgSrc, onCropped }: ImageCropperDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1, // aspect ratio 1:1
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  }

  const handleSaveCrop = async () => {
    if (completedCrop && imgRef.current) {
        const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
        onCropped(croppedImageBlob);
        setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rogner la photo</DialogTitle>
          <DialogDescription>
            Ajustez la photo pour qu'elle s'adapte parfaitement à votre profil.
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative h-64 w-full bg-muted">
            {imgSrc && (
                <ReactCrop
                    crop={crop}
                    onChange={c => setCrop(c)}
                    onComplete={c => setCompletedCrop(c)}
                    aspect={1}
                    circularCrop
                >
                    <img 
                        ref={imgRef}
                        alt="Crop me" 
                        src={imgSrc} 
                        onLoad={onImageLoad}
                        style={{ maxHeight: '60vh' }}
                    />
                </ReactCrop>
            )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
          <Button onClick={handleSaveCrop}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
