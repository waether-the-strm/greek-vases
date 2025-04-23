import { useEffect, useState, useRef, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Import the asset URLs using Vite's ?url feature
import galleryModelUrl from "/assets/uploads_files_2797881_AircraftHangarCarGarage.glb?url";
import windowTextureUrl from "/assets/window_texture.png?url"; // Import window texture URL
import backgroundTextureUrl from "/assets/background_view2.jpg?url"; // Import background texture URL

interface GalleryLoaderProps {
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  onLoad?: (model: THREE.Group) => void; // Optional callback after model is loaded
  isLightMode: boolean;
  textureRefs: React.MutableRefObject<{
    windowTexture: THREE.Texture | null;
    backgroundTexture: THREE.Texture | null;
  }>;
}

// Define the return type of the hook
interface GalleryLoaderResult {
  galleryModel: THREE.Group | null;
  windowPane: THREE.Mesh | null;
  backgroundPlane: THREE.Mesh | null;
  directionalLight: THREE.DirectionalLight | null;
}

export const useGalleryLoader = ({
  sceneRef,
  onLoad,
  isLightMode,
  textureRefs,
}: GalleryLoaderProps): GalleryLoaderResult => {
  const [galleryModel, setGalleryModel] = useState<THREE.Group | null>(null);
  const [windowPane, setWindowPane] = useState<THREE.Mesh | null>(null);
  const [backgroundPlane, setBackgroundPlane] = useState<THREE.Mesh | null>(
    null
  );
  const [directionalLight, setDirectionalLight] =
    useState<THREE.DirectionalLight | null>(null);
  const modelLoadedRef = useRef(false);

  // Function to update materials
  const updateMaterials = useCallback(
    (model: THREE.Group, _scene: THREE.Scene, isLight: boolean) => {
      const galleryParts: THREE.Mesh[] = [];
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (
            child.name.toLowerCase().includes("wall") ||
            child.name.toLowerCase().includes("ceiling") ||
            child.name.toLowerCase().includes("floor")
          ) {
            galleryParts.push(child);
          }
        }
      });

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;

          if (child.material && !Array.isArray(child.material)) {
            const oldMaterial = child.material as THREE.MeshStandardMaterial;
            const isGalleryPart = galleryParts.includes(child);

            const baseColor = isGalleryPart
              ? isLight
                ? 0xc8e3ff
                : 0x1a2a3f
              : isLight
              ? oldMaterial.color.getHex()
              : oldMaterial.color.getHex() * 0.3;

            const standardMaterial = new THREE.MeshStandardMaterial({
              color: baseColor,
              map: oldMaterial.map,
              roughness: 0.1,
              metalness: 0.0,
              flatShading: true,
            });

            if (oldMaterial.dispose) {
              oldMaterial.dispose();
            }

            child.material = standardMaterial;

            if (child.geometry) {
              child.geometry.computeVertexNormals();
            }
          }
        }
      });
    },
    []
  );

  useEffect(() => {
    if (!sceneRef.current || modelLoadedRef.current) return;

    const scene = sceneRef.current;
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();

    let isMounted = true;

    // Load textures first if they don't exist
    if (!textureRefs.current.windowTexture) {
      const windowTexture = textureLoader.load(windowTextureUrl);
      windowTexture.colorSpace = THREE.SRGBColorSpace;
      textureRefs.current.windowTexture = windowTexture;
    }

    if (!textureRefs.current.backgroundTexture) {
      const backgroundTexture = textureLoader.load(backgroundTextureUrl);
      backgroundTexture.colorSpace = THREE.SRGBColorSpace;
      textureRefs.current.backgroundTexture = backgroundTexture;
    }

    loader.load(
      galleryModelUrl,
      (gltf) => {
        if (!isMounted) return;

        const loadedGalleryModel = gltf.scene;
        loadedGalleryModel.scale.set(0.02, 0.02, 0.02);
        loadedGalleryModel.position.set(0, 1.7, 0);

        updateMaterials(loadedGalleryModel, scene, isLightMode);

        scene.add(loadedGalleryModel);
        setGalleryModel(loadedGalleryModel);
        modelLoadedRef.current = true;

        if (onLoad) {
          onLoad(loadedGalleryModel);
        }

        // Window setup
        const windowGeometry = new THREE.PlaneGeometry(35, 12);
        const windowMaterial = new THREE.MeshBasicMaterial({
          map: textureRefs.current.windowTexture,
          transparent: true,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
          opacity: isLightMode ? 1.0 : 0.3,
        });

        const createdWindowPane = new THREE.Mesh(
          windowGeometry,
          windowMaterial
        );
        createdWindowPane.position.set(0, 5, 20.5);
        setWindowPane(createdWindowPane);

        // Background setup
        const backgroundGeometry = new THREE.PlaneGeometry(40, 15);
        const backgroundMaterial = new THREE.MeshBasicMaterial({
          map: textureRefs.current.backgroundTexture,
          side: THREE.DoubleSide,
          opacity: isLightMode ? 1.0 : 0.1,
          transparent: true,
        });

        const createdBackgroundPlane = new THREE.Mesh(
          backgroundGeometry,
          backgroundMaterial
        );
        createdBackgroundPlane.position.set(0, 5, 21);
        setBackgroundPlane(createdBackgroundPlane);

        // Light setup
        const createdDirectionalLight = new THREE.DirectionalLight(
          isLightMode ? 0xffffff : 0x202020,
          isLightMode ? 1.5 : 0.3
        );
        createdDirectionalLight.position.set(0, 7, 25);
        createdDirectionalLight.target.position.set(0, 2, 0);
        createdDirectionalLight.castShadow = true;
        createdDirectionalLight.shadow.mapSize.width = 2048;
        createdDirectionalLight.shadow.mapSize.height = 2048;
        createdDirectionalLight.shadow.camera.near = 0.5;
        createdDirectionalLight.shadow.camera.far = 50;
        createdDirectionalLight.shadow.camera.left = -20;
        createdDirectionalLight.shadow.camera.right = 20;
        createdDirectionalLight.shadow.camera.top = 20;
        createdDirectionalLight.shadow.camera.bottom = -20;
        setDirectionalLight(createdDirectionalLight);
      },
      undefined,
      (error) => {
        if (isMounted) {
          console.error("Error loading gallery model:", error);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [sceneRef, isLightMode, updateMaterials, onLoad, textureRefs]);

  // Effect to update materials when light mode changes
  useEffect(() => {
    if (!galleryModel || !sceneRef.current) return;
    updateMaterials(galleryModel, sceneRef.current, isLightMode);

    // Update window and background materials
    if (windowPane?.material) {
      const material = windowPane.material as THREE.MeshBasicMaterial;
      material.opacity = isLightMode ? 1.0 : 0.3;
      material.needsUpdate = true;
    }
    if (backgroundPlane?.material) {
      const material = backgroundPlane.material as THREE.MeshBasicMaterial;
      material.opacity = isLightMode ? 1.0 : 0.1;
      material.needsUpdate = true;
    }
    if (directionalLight) {
      directionalLight.color.setHex(isLightMode ? 0xffffff : 0x202020);
      directionalLight.intensity = isLightMode ? 1.5 : 0.3;
    }
  }, [
    isLightMode,
    galleryModel,
    windowPane,
    backgroundPlane,
    directionalLight,
    updateMaterials,
  ]);

  const handleLightModeChange = useCallback(
    (isLightMode: boolean) => {
      if (windowPane?.material) {
        const material = windowPane.material as THREE.MeshBasicMaterial;
        material.opacity = isLightMode ? 1.0 : 0.3;
        material.needsUpdate = true;
      }
      if (backgroundPlane?.material) {
        const material = backgroundPlane.material as THREE.MeshBasicMaterial;
        material.opacity = isLightMode ? 1.0 : 0.1;
        material.needsUpdate = true;
      }
    },
    [windowPane, backgroundPlane]
  );

  return { galleryModel, windowPane, backgroundPlane, directionalLight };
};
