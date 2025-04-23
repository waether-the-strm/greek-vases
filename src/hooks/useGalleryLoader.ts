import { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RectAreaLight } from "three/src/lights/RectAreaLight.js";

// Import the asset URLs using Vite's ?url feature
import galleryModelUrl from "/assets/uploads_files_2797881_AircraftHangarCarGarage.glb?url";
import windowTextureUrl from "/assets/window_texture.png?url"; // Import window texture URL
import backgroundTextureUrl from "/assets/background_view2.jpg?url"; // Import background texture URL

interface GalleryLoaderProps {
  sceneRef: React.RefObject<THREE.Scene>;
  initializationStatus: "pending" | "ready";
}

// Define the return type of the hook
interface GalleryLoaderResult {
  galleryModel: THREE.Group | null;
  windowPane: THREE.Mesh | null;
  backgroundPlane: THREE.Mesh | null;
  galleryDirectionalLightRef: React.RefObject<THREE.DirectionalLight | null>;
  rectAreaLightRef: React.RefObject<RectAreaLight | null>;
}

const updateMaterials = (model: THREE.Object3D) => {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material as THREE.MeshStandardMaterial;
      if (material) {
        material.color.set(0xffffff);
        material.roughness = 0.7;
        material.metalness = 0.0;
        material.envMapIntensity = 0.5;
        material.needsUpdate = true;
      }
    }
  });
};

export const useGalleryLoader = ({
  sceneRef,
  initializationStatus,
}: GalleryLoaderProps): GalleryLoaderResult => {
  const [galleryModel, setGalleryModel] = useState<THREE.Group | null>(null);
  const [windowPane, setWindowPane] = useState<THREE.Mesh | null>(null);
  const [backgroundPlane, setBackgroundPlane] = useState<THREE.Mesh | null>(
    null
  );
  const galleryDirectionalLightRef = useRef<THREE.DirectionalLight | null>(
    null
  );
  const rectAreaLightRef = useRef<RectAreaLight | null>(null);
  const modelLoadedRef = useRef(false);

  useEffect(() => {
    if (
      initializationStatus !== "ready" ||
      !sceneRef.current ||
      modelLoadedRef.current
    ) {
      console.log(
        `useGalleryLoader useEffect skipped: status=${initializationStatus}, sceneRef=${!!sceneRef.current}, modelLoaded=${
          modelLoadedRef.current
        }`
      );
      return;
    }
    console.log("useGalleryLoader useEffect running (scene is ready)...");

    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();

    let isMounted = true;

    console.log("Starting GLB load...");
    loader.load(
      galleryModelUrl,
      (gltf) => {
        console.log("GLB loaded successfully!");
        if (!isMounted) {
          console.log("Component unmounted before GLB processing.");
          return;
        }

        const loadedGalleryModel = gltf.scene;
        loadedGalleryModel.name = "GalleryModel";
        console.log("Applying scale and position to gallery model...");
        loadedGalleryModel.scale.set(0.02, 0.02, 0.02);
        loadedGalleryModel.position.set(0, 1.7, 0);

        console.log("Updating gallery model materials...");
        updateMaterials(loadedGalleryModel);

        console.log("Setting gallery model state...");
        setGalleryModel(loadedGalleryModel);
        modelLoadedRef.current = true;

        console.log("Creating window pane...");
        const windowWidth = 35;
        const windowHeight = 12;
        const windowPosition = new THREE.Vector3(0, 5, 20.5);
        const windowGeometry = new THREE.PlaneGeometry(
          windowWidth,
          windowHeight
        );
        const windowTexture = textureLoader.load(
          windowTextureUrl,
          () => console.log("Window texture loaded."),
          undefined,
          (err) => console.error("Error loading window texture:", err)
        );
        const windowMaterial = new THREE.MeshBasicMaterial({
          map: windowTexture,
          transparent: true,
          side: THREE.DoubleSide,
          color: 0xffffff,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const createdWindowPane = new THREE.Mesh(
          windowGeometry,
          windowMaterial
        );
        createdWindowPane.name = "WindowPane";
        createdWindowPane.position.copy(windowPosition);
        console.log("Setting window pane state...");
        setWindowPane(createdWindowPane);

        console.log("Creating RectAreaLight...");
        const createdRectAreaLight = new RectAreaLight(
          0xffffff,
          1,
          windowWidth * 0.95,
          windowHeight * 0.95
        );
        createdRectAreaLight.name = "WindowRectAreaLight";
        createdRectAreaLight.position.copy(windowPosition);
        createdRectAreaLight.lookAt(
          windowPosition.x,
          windowPosition.y - 1,
          windowPosition.z - 5
        );
        if (isMounted) {
          rectAreaLightRef.current = createdRectAreaLight;
          console.log("RectAreaLight ref set:", rectAreaLightRef.current);
        }

        console.log("Creating background plane...");
        const backgroundGeometry = new THREE.PlaneGeometry(40, 15);
        const backgroundTexture = textureLoader.load(
          backgroundTextureUrl,
          () => console.log("Background texture loaded."),
          undefined,
          (err) => console.error("Error loading background texture:", err)
        );
        const backgroundMaterial = new THREE.MeshBasicMaterial({
          map: backgroundTexture,
          side: THREE.DoubleSide,
          opacity: 1.0,
          transparent: true,
        });
        const createdBackgroundPlane = new THREE.Mesh(
          backgroundGeometry,
          backgroundMaterial
        );
        createdBackgroundPlane.name = "BackgroundPlane";
        createdBackgroundPlane.position.set(0, 5, 21);
        console.log("Setting background plane state...");
        setBackgroundPlane(createdBackgroundPlane);

        console.log("Creating directional light...");
        const createdDirectionalLight = new THREE.DirectionalLight(
          0xfff5e6,
          0.4
        );
        createdDirectionalLight.name = "GalleryDirectionalLight";
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
        createdDirectionalLight.shadow.radius = 8;
        createdDirectionalLight.shadow.bias = -0.0005;
        console.log("Setting directional light ref...");
        if (isMounted) {
          galleryDirectionalLightRef.current = createdDirectionalLight;
          console.log(
            "GalleryDirectionalLight ref set:",
            galleryDirectionalLightRef.current
          );
        }
      },
      undefined,
      (error) => {
        if (isMounted) {
          console.error("!!! Fatal Error loading gallery model:", error);
        }
      }
    );

    return () => {
      console.log("useGalleryLoader useEffect cleanup.");
      isMounted = false;
      // Optional: Clear the ref on cleanup if needed, though the light object itself might be managed elsewhere
      // galleryDirectionalLightRef.current = null;
    };
  }, [sceneRef, initializationStatus]);

  return {
    galleryModel,
    windowPane,
    backgroundPlane,
    galleryDirectionalLightRef,
    rectAreaLightRef,
  };
};
