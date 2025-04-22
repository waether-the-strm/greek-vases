import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  canJump: boolean; // Keep for potential future use
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
    rotation: new THREE.Euler(0, 0, 0, "YXZ"),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    canJump: false,
  });

  // Event Handlers memoized with useCallback
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case "KeyW":
        playerStateRef.current.moveForward = true;
        break;
      case "KeyS":
        playerStateRef.current.moveBackward = true;
        break;
      case "KeyA":
        playerStateRef.current.moveLeft = true;
        break;
      case "KeyD":
        playerStateRef.current.moveRight = true;
        break;
    }
  }, []);

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
    const velocity = player.velocity; // Use velocity from state
    const direction = new THREE.Vector3();

    direction.z = Number(player.moveForward) - Number(player.moveBackward);
    direction.x = Number(player.moveLeft) - Number(player.moveRight);
    direction.normalize(); // Ensure consistent speed in all directions

    // Simplified velocity calculation (adjust speed factor as needed)
    const moveSpeed = 0.1;
    velocity.z = direction.z * moveSpeed;
    velocity.x = direction.x * moveSpeed;

    // Apply rotation to movement direction
    const euler = new THREE.Euler(0, player.rotation.y, 0, "YXZ");
    const moveDirection = new THREE.Vector3(velocity.x, 0, velocity.z);
    moveDirection.applyEuler(euler);

    // Update camera position
    cameraRef.current.position.x += moveDirection.x;
    cameraRef.current.position.z += moveDirection.z;

    // Keep camera height constant
    cameraRef.current.position.y = cameraHeight;

    // Update player state position (for potential future use like collision)
    player.position.copy(cameraRef.current.position);
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
