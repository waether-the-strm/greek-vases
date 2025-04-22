import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// Define jump strength and gravity constants
const JUMP_STRENGTH = 0.18;
const GRAVITY = 0.007;

export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  isOnGround: boolean; // Renamed from canJump for clarity
}

interface UsePlayerControlsProps {
  isPointerLocked: boolean;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  initialPosition?: THREE.Vector3;
  cameraHeight: number;
}

export const usePlayerControls = ({
  isPointerLocked,
  cameraRef,
  initialPosition = new THREE.Vector3(0, 2.5, -12), // Default initial position
  cameraHeight,
}: UsePlayerControlsProps) => {
  const playerStateRef = useRef<PlayerState>({
    position: initialPosition.clone(),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Euler(0, Math.PI, 0, "YXZ"),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    isOnGround: false, // Start assuming not on ground initially
  });

  // Event Handlers memoized with useCallback
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const player = playerStateRef.current;
    switch (event.code) {
      case "KeyW":
        player.moveForward = true;
        break;
      case "KeyS":
        player.moveBackward = true;
        break;
      case "KeyA":
        player.moveLeft = true;
        break;
      case "KeyD":
        player.moveRight = true;
        break;
      case "Space": // Handle jump
        if (player.isOnGround) {
          player.velocity.y = JUMP_STRENGTH;
          player.isOnGround = false;
        }
        break;
    }
  }, []); // No dependencies needed here as it only modifies the ref

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case "KeyW":
        playerStateRef.current.moveForward = false;
        break;
      case "KeyS":
        playerStateRef.current.moveBackward = false;
        break;
      case "KeyA":
        playerStateRef.current.moveLeft = false;
        break;
      case "KeyD":
        playerStateRef.current.moveRight = false;
        break;
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isPointerLocked || !cameraRef.current) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      playerStateRef.current.rotation.y -= movementX * 0.002;
      playerStateRef.current.rotation.x -= movementY * 0.002;

      // Clamp vertical rotation
      playerStateRef.current.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, playerStateRef.current.rotation.x)
      );

      // Apply rotation to the camera
      cameraRef.current.rotation.copy(playerStateRef.current.rotation);
    },
    [isPointerLocked, cameraRef]
  );

  // Function to update player position based on state
  const updatePlayerPosition = useCallback(() => {
    if (!cameraRef.current) return;

    const player = playerStateRef.current;
    const camera = cameraRef.current;
    const velocity = player.velocity; // Use velocity from state
    const direction = new THREE.Vector3();

    // Horizontal movement direction
    direction.z = Number(player.moveBackward) - Number(player.moveForward);
    direction.x = Number(player.moveRight) - Number(player.moveLeft);
    direction.normalize();

    const moveSpeed = 0.1;
    const horizontalVelocity = new THREE.Vector3(
      direction.x * moveSpeed,
      0,
      direction.z * moveSpeed
    );

    // Apply rotation to horizontal movement direction
    const euler = new THREE.Euler(0, player.rotation.y, 0, "YXZ");
    const moveDirection = horizontalVelocity.applyEuler(euler);

    // --- Vertical Movement (Gravity and Jumping) ---
    velocity.y -= GRAVITY; // Apply gravity
    camera.position.y += velocity.y; // Apply vertical velocity

    // Ground check
    if (camera.position.y <= cameraHeight) {
      camera.position.y = cameraHeight;
      velocity.y = 0; // Stop vertical movement
      player.isOnGround = true; // Player is on the ground
    } else {
      player.isOnGround = false; // Player is in the air
    }

    // --- Horizontal Movement (with Boundaries) ---
    const nextPositionX = camera.position.x + moveDirection.x;
    const nextPositionZ = camera.position.z + moveDirection.z;

    const bounds = { xMin: -9.5, xMax: 9.5, zMin: -14.5, zMax: 14.5 };

    // Apply horizontal movement only if within bounds
    if (nextPositionX >= bounds.xMin && nextPositionX <= bounds.xMax) {
      camera.position.x = nextPositionX;
    }
    if (nextPositionZ >= bounds.zMin && nextPositionZ <= bounds.zMax) {
      camera.position.z = nextPositionZ;
    }
    // Note: This simple boundary check prevents sliding.
    // To re-enable sliding, separate the checks like before:
    // let allowedMoveX = nextPositionX >= bounds.xMin && nextPositionX <= bounds.xMax;
    // let allowedMoveZ = nextPositionZ >= bounds.zMin && nextPositionZ <= bounds.zMax;
    // if (allowedMoveX) { camera.position.x += moveDirection.x; }
    // if (allowedMoveZ) { camera.position.z += moveDirection.z; }

    // Update player state position
    player.position.copy(camera.position);
  }, [cameraRef, cameraHeight]);

  // Effect to attach and detach event listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleKeyDown, handleKeyUp, handleMouseMove]);

  // Return necessary values/functions for the component to use
  return {
    playerStateRef, // Expose the ref if direct access needed elsewhere
    updatePlayerPosition, // Expose the update function for the animation loop
    // The handlers are managed internally by the hook via useEffect
  };
};
