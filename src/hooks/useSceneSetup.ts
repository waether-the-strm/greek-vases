import { useRef, useEffect } from "react";
import * as THREE from "three";

interface SceneSetupProps {
  mountRef: React.RefObject<HTMLDivElement>;
  cameraHeight: number;
}

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
      if (rendererRef.current) {
        // Dispose renderer resources
        rendererRef.current.dispose();
        // Check if the renderer's DOM element is still a child before removing
        if (rendererRef.current.domElement.parentNode === currentMount) {
          currentMount.removeChild(rendererRef.current.domElement);
        }
      }
      // Scene and camera objects are managed by refs and will be garbage collected
      // If we added complex objects (geometries, materials) here, we'd dispose them too.
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
  }, [mountRef, cameraHeight]); // Rerun effect if mountRef or cameraHeight changes

  return { sceneRef, cameraRef, rendererRef };
};
