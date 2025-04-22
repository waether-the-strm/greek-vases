import { useRef, useEffect } from "react";
import * as THREE from "three";

interface SceneSetupProps {
  mountRef: React.RefObject<HTMLDivElement>;
  cameraHeight: number;
}

// Helper functions for environment setup (internal to the hook)
const setupLights = (scene: THREE.Scene) => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
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
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 8, -7.5);
  fillLight.castShadow = false;
  scene.add(fillLight);
  // Return lights for cleanup
  return [ambientLight, directionalLight, fillLight];
};

const setupFloor = (scene: THREE.Scene) => {
  const floorGeometry = new THREE.BoxGeometry(10, 0.2, 30);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.5,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
  // Return floor for cleanup
  return floor;
};

const setupWalls = (scene: THREE.Scene) => {
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xfafafa,
    roughness: 0.2,
  });
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 5, 30),
    wallMaterial
  );
  leftWall.position.set(-10, 2.5, 0);
  leftWall.receiveShadow = true;
  scene.add(leftWall);
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 5, 30),
    wallMaterial
  );
  rightWall.position.set(10, 2.5, 0);
  rightWall.receiveShadow = true;
  scene.add(rightWall);
  // Return walls for cleanup
  return [leftWall, rightWall];
};

export const useSceneSetup = ({ mountRef, cameraHeight }: SceneSetupProps) => {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current;
    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, cameraHeight, -12); // Initial position consistent with player start
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Setup environment elements
    const lights = setupLights(scene);
    const floor = setupFloor(scene);
    const walls = setupWalls(scene);

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
      if (floor) {
        scene.remove(floor);
        floor.geometry.dispose();
        if (floor.material instanceof THREE.Material) floor.material.dispose();
      }
      if (walls) {
        walls.forEach((wall) => {
          scene.remove(wall);
          wall.geometry.dispose();
          // Dispose material only once if shared (it's not shared here)
          if (wall.material instanceof THREE.Material) wall.material.dispose();
        });
      }

      // Cleanup renderer
      if (rendererRef.current) {
        // Dispose renderer resources
        rendererRef.current.dispose();
        // Check if the renderer's DOM element is still a child before removing
        if (rendererRef.current.domElement.parentNode === currentMount) {
          currentMount.removeChild(rendererRef.current.domElement);
        }
      }

      // Nullify refs
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
  }, [mountRef, cameraHeight]); // Rerun effect if mountRef or cameraHeight changes

  return { sceneRef, cameraRef, rendererRef };
};
