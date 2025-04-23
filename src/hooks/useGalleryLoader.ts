import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Import the asset URLs using Vite's ?url feature
import galleryModelUrl from "/assets/uploads_files_2797881_AircraftHangarCarGarage.glb?url";
import windowTextureUrl from "/assets/window_texture.png?url"; // Import window texture URL
import backgroundTextureUrl from "/assets/background_view2.jpg?url"; // Import background texture URL

interface GalleryLoaderProps {
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  onLoad?: (model: THREE.Group) => void; // Optional callback after model is loaded
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
}: GalleryLoaderProps): GalleryLoaderResult => {
  // Use state to store the created objects to be returned
  const [galleryModel, setGalleryModel] = useState<THREE.Group | null>(null);
  const [windowPane, setWindowPane] = useState<THREE.Mesh | null>(null);
  const [backgroundPlane, setBackgroundPlane] = useState<THREE.Mesh | null>(
    null
  );
  const [directionalLight, setDirectionalLight] =
    useState<THREE.DirectionalLight | null>(null);

  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader(); // Reuse texture loader

    // Keep track if the component is still mounted
    let isMounted = true;

    loader.load(
      galleryModelUrl,
      (gltf) => {
        if (!isMounted) return; // Don't process if unmounted

        const loadedGalleryModel = gltf.scene;

        // Optional: Adjust model scale, position, rotation if needed
        loadedGalleryModel.scale.set(0.02, 0.02, 0.02); // Scale down further
        loadedGalleryModel.position.set(0, 1.7, 0);
        // loadedGalleryModel.rotation.y = Math.PI; // Example rotation

        // Enable shadows and disable frustum culling for all meshes
        loadedGalleryModel.traverse((child) => {
          // Check if child is a Mesh before accessing material/shadow properties
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            // Apply base pastel color to hangar materials
            if (child.material && !Array.isArray(child.material)) {
              // Assuming MeshStandardMaterial or similar with a color property
              (child.material as THREE.MeshStandardMaterial).color.set(
                0xbae1ff
              ); // Light blue
              // Optional: Adjust other material properties if needed
              // (child.material as THREE.MeshStandardMaterial).roughness = 0.9;
            }
            // Optional: Adjust materials if needed (Example was envMapIntensity)
            // if (child.material && !Array.isArray(child.material)) { // Ensure check here too
            //   ((child.material as THREE.MeshStandardMaterial).envMapIntensity = 0.5;
          }
        });

        scene.add(loadedGalleryModel);
        setGalleryModel(loadedGalleryModel); // Store gallery model in state
        console.log("Gallery model loaded and added to scene.");
        console.log(
          "Gallery parent UUID:",
          loadedGalleryModel.parent?.uuid,
          "Scene UUID:",
          scene.uuid
        ); // Log parent UUID

        if (onLoad) {
          onLoad(loadedGalleryModel); // Call the callback if provided
        }

        // --- Add Window Plane ---
        const windowGeometry = new THREE.PlaneGeometry(35, 12); // Increased size
        const windowTexture = textureLoader.load(windowTextureUrl);
        windowTexture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space if needed

        const windowMaterial = new THREE.MeshBasicMaterial({
          // color: 0xddddff, // Color comes from texture now
          map: windowTexture, // Apply the texture
          transparent: true, // Enable transparency
          alphaTest: 0.1, // Adjust if needed for sharp alpha edges
          side: THREE.DoubleSide,
        });
        const createdWindowPane = new THREE.Mesh(
          windowGeometry,
          windowMaterial
        );
        createdWindowPane.position.set(0, 5, 20.5);
        // scene.add(createdWindowPane); // Don't add here, return it
        setWindowPane(createdWindowPane); // Store window pane in state
        console.log("Window plane created.");
        // --- End Window Plane ---

        // --- Add Background Plane ---
        const backgroundGeometry = new THREE.PlaneGeometry(40, 15); // Slightly larger than window
        const backgroundTexture = textureLoader.load(backgroundTextureUrl);
        backgroundTexture.colorSpace = THREE.SRGBColorSpace;

        const backgroundMaterial = new THREE.MeshBasicMaterial({
          map: backgroundTexture,
          side: THREE.DoubleSide, // Visible from both sides just in case
        });
        const createdBackgroundPlane = new THREE.Mesh(
          backgroundGeometry,
          backgroundMaterial
        );
        // Position it slightly behind the window - initial position
        createdBackgroundPlane.position.set(0, 5, 21);
        // scene.add(createdBackgroundPlane); // Don't add here, return it
        setBackgroundPlane(createdBackgroundPlane); // Store background plane in state
        console.log("Background plane created.");
        // --- End Background Plane ---

        // --- Add Directional Light from Window ---
        const createdDirectionalLight = new THREE.DirectionalLight(
          0xffffff,
          1.5
        ); // White light, adjust intensity
        createdDirectionalLight.position.set(0, 7, 25); // Experiment with position
        createdDirectionalLight.target.position.set(0, 2, 0); // Target the center area where vases might be

        createdDirectionalLight.castShadow = true;
        // Configure shadow map
        createdDirectionalLight.shadow.mapSize.width = 2048; // Higher resolution for sharper shadows
        createdDirectionalLight.shadow.mapSize.height = 2048;
        createdDirectionalLight.shadow.camera.near = 0.5;
        createdDirectionalLight.shadow.camera.far = 50;
        // Optional: Adjust shadow camera frustum (left, right, top, bottom) if needed
        createdDirectionalLight.shadow.camera.left = -20;
        createdDirectionalLight.shadow.camera.right = 20;
        createdDirectionalLight.shadow.camera.top = 20;
        createdDirectionalLight.shadow.camera.bottom = -20;

        // scene.add(createdDirectionalLight);
        // scene.add(createdDirectionalLight.target); // Don't add target here explicitly if light is added later
        setDirectionalLight(createdDirectionalLight); // Store light in state
        console.log("Directional light created.");

        // Optional: Add a helper to visualize the light's direction and shadow camera
        // const lightHelper = new THREE.DirectionalLightHelper(createdDirectionalLight, 5);
        // scene.add(lightHelper);
        // const shadowCameraHelper = new THREE.CameraHelper(createdDirectionalLight.shadow.camera);
        // scene.add(shadowCameraHelper);
        // --- End Directional Light ---
      },
      (xhr) => {
        // Optional: Loading progress
        // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      (error) => {
        if (isMounted) {
          console.error("Error loading gallery model:", error);
        }
      }
    );

    // Cleanup function
    return () => {
      isMounted = false;
      // Optional: More specific cleanup if needed, e.g., disposing geometries/materials
      // if (galleryModel) scene.remove(galleryModel); // Removal should happen in parent component now
      // if (windowPane) scene.remove(windowPane);
      // if (backgroundPlane) scene.remove(backgroundPlane);
      // if (directionalLight) scene.remove(directionalLight);
    };
  }, [sceneRef, onLoad]); // Dependency array

  // Return the created objects
  return { galleryModel, windowPane, backgroundPlane, directionalLight };
};
