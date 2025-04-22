import { useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Import the asset URL using Vite's ?url feature
import galleryModelUrl from "/assets/uploads_files_2797881_AircraftHangarCarGarage.glb?url";

interface GalleryLoaderProps {
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  onLoad?: (model: THREE.Group) => void; // Optional callback after model is loaded
}

export const useGalleryLoader = ({ sceneRef, onLoad }: GalleryLoaderProps) => {
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const loader = new GLTFLoader();

    loader.load(
      // '/assets/uploads_files_2797881_AircraftHangarCarGarage.glb', // Old path
      galleryModelUrl, // Use the imported URL
      (gltf) => {
        const galleryModel = gltf.scene;

        // Optional: Adjust model scale, position, rotation if needed
        galleryModel.scale.set(0.02, 0.02, 0.02); // Scale down further
        // galleryModel.position.set(0, 0, 0);
        // galleryModel.rotation.y = Math.PI; // Example rotation

        // Enable shadows and disable frustum culling for all meshes
        galleryModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            // Optional: Adjust materials if needed
            // if ((child as THREE.Mesh).material) {
            //   ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).envMapIntensity = 0.5; // Example adjustment
            // }
          }
        });

        scene.add(galleryModel);
        console.log("Gallery model loaded and added to scene.");
        console.log(
          "Gallery parent UUID:",
          galleryModel.parent?.uuid,
          "Scene UUID:",
          scene.uuid
        ); // Log parent UUID

        if (onLoad) {
          onLoad(galleryModel); // Call the callback if provided
        }
      },
      (xhr) => {
        // Optional: Loading progress
        // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      (error) => {
        console.error("Error loading gallery model:", error);
      }
    );

    // Cleanup function (optional, if specific cleanup needed for the loader/model)
    // return () => {
    //   // Find and remove the model if necessary, dispose resources
    // };
  }, [sceneRef, onLoad]); // Dependency array

  // This hook doesn't return anything directly, it modifies the scene
};
