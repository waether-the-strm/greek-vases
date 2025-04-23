import { useRef, useEffect } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

interface SceneSetupProps {
  mountRef: React.RefObject<HTMLDivElement>;
  cameraHeight: number;
}

// Helper functions for environment setup (internal to the hook)
const setupLights = (scene: THREE.Scene) => {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -15;
  directionalLight.shadow.camera.right = 15;
  directionalLight.shadow.camera.top = 15;
  directionalLight.shadow.camera.bottom = -15;
  directionalLight.shadow.radius = 4;
  directionalLight.shadow.bias = -0.0005;
  scene.add(directionalLight);
  return [directionalLight];
};

// Reintroduce setupFloor function with PlaneGeometry
const setupFloor = (scene: THREE.Scene) => {
  const floorGeometry = new THREE.PlaneGeometry(50, 50); // Large plane
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555, // Different gray for visibility
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide, // Render both sides just in case
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2; // Rotate plane to be horizontal
  floor.position.y = 0; // Position at ground level
  floor.receiveShadow = true;
  scene.add(floor);
  console.log(
    "Floor parent UUID:",
    floor.parent?.uuid,
    "Scene UUID:",
    scene.uuid
  ); // Log parent UUID
  return floor;
};

// Helper function to create measurement markers
const setupMeasurementHelpers = (scene: THREE.Scene) => {
  const markers = [];
  const markerGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red markers
  const range = 20; // How far out to place markers
  const step = 5; // Distance between markers

  for (let i = -range; i <= range; i += step) {
    if (i === 0) continue; // Skip origin
    // X-axis markers
    const markerX = new THREE.Mesh(markerGeometry, markerMaterial);
    markerX.position.set(i, 0.1, 0);
    scene.add(markerX);
    markers.push(markerX);

    // Z-axis markers
    const markerZ = new THREE.Mesh(markerGeometry, markerMaterial);
    markerZ.position.set(0, 0.1, i);
    scene.add(markerZ);
    markers.push(markerZ);
  }
  console.log(`Added ${markers.length} measurement markers.`);
  return markers;
};

export const useSceneSetup = ({ mountRef, cameraHeight }: SceneSetupProps) => {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);
  const environmentTextureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current;
    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    // Renderer (Setup earlier to be used by PMREMGenerator)
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // PMREMGenerator for RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGeneratorRef.current = pmremGenerator;

    // Scene
    const scene = new THREE.Scene();
    const environment = new RoomEnvironment();
    const envTexture = pmremGenerator.fromScene(environment, 0.04).texture;
    scene.environment = envTexture;
    scene.background = new THREE.Color(0x333333);
    environmentTextureRef.current = envTexture;
    environment.dispose();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 1000);
    camera.position.set(0, cameraHeight, -12);
    cameraRef.current = camera;

    // Setup environment elements
    const lights = setupLights(scene);
    const floor = setupFloor(scene);
    const measurementMarkers = setupMeasurementHelpers(scene);

    // Basic resize handling within the setup hook
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !currentMount) return;

      const newWidth = currentMount.clientWidth;
      const newHeight = currentMount.clientHeight;

      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize);

      // Cleanup environment elements
      lights.forEach((light) => scene.remove(light));
      // Add floor cleanup again
      if (floor) {
        scene.remove(floor);
        floor.geometry.dispose();
        if (Array.isArray(floor.material)) {
          floor.material.forEach((m) => m.dispose());
        } else {
          floor.material.dispose();
        }
      }
      // Cleanup markers
      measurementMarkers.forEach((marker) => {
        scene.remove(marker);
        marker.geometry.dispose();
        // Material is shared, dispose only once if needed, but MeshBasicMaterial is cheap
      });

      // Cleanup environment map and generator
      if (environmentTextureRef.current) {
        environmentTextureRef.current.dispose();
        environmentTextureRef.current = null;
      }
      if (pmremGeneratorRef.current) {
        pmremGeneratorRef.current.dispose();
        pmremGeneratorRef.current = null;
      }

      // Cleanup renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement.parentNode === currentMount) {
          currentMount.removeChild(rendererRef.current.domElement);
        }
      }

      // Nullify refs
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
  }, [mountRef, cameraHeight]);

  return { sceneRef, cameraRef, rendererRef };
};
