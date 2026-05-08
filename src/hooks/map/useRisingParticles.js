import { SpriteManager, Sprite, Vector3, Color4 } from "@babylonjs/core";

/**
 * Hook to create rising particle effects using a sprite sheet.
 * @param {Scene} scene - Babylon.js Scene
 */
export default function useRisingParticles(scene) {
    let spriteManager;
    let updateObserver;

    /**
     * Initialize the rising particles.
     * @param {Vector3} center - The center position of the map (y is ignored/base)
     * @param {number} width - The width/size of the map for distribution range
     */
    const initParticles = (center, width) => {
        // Create SpriteManager
        // Capacity: 50 particles
        // Cell dimensions: 180x189 (from user provided info)
        spriteManager = new SpriteManager(
            "risingParticleMgr",
            "/data/map/上升粒子1.png",
            25,
            { width: 180, height: 189 },
            scene
        );
        
        // Sprite manager settings
        spriteManager.isPickable = false;
        // Enable glow by ensuring material is treated as emissive or simply handled by GlowLayer
        // SpriteManager doesn't expose standard material properties easily, 
        // but adding it to the scene generally allows GlowLayer to pick up bright colors if threshold allows.
        // However, for Sprites, we can try to ensure they are bright enough.
        
        // Note: Babylon's GlowLayer automatically glows pixels brighter than a threshold.
        // Since we want these to glow, we can boost their color or ensure the GlowLayer includes them.
        // Sprites are rendered by the SpriteManager. We can add the SpriteManager to the GlowLayer in App.vue if needed,
        // but usually global GlowLayer picks up everything. 
        // To force glow, we can try setting the color to > 1.0 (emissive-like behavior).

        const count = 25; // Number of particles
        const range = width * 1.1; // Match rotating-point2.png size (width * 1.1)
        const sprites = [];
        const MAX_LIFETIME = 3.0; // 3 seconds lifecycle

        for (let i = 0; i < count; i++) {
            const sprite = new Sprite("rp_" + i, spriteManager);
            
            // Random position within a circle around the center
            const angle = Math.random() * Math.PI * 2;
            // Use sqrt for uniform distribution, max radius = range / 2
            const dist = Math.sqrt(Math.random()) * (range / 2);
            
            const x = center.x + Math.cos(angle) * dist;
            const z = center.z + Math.sin(angle) * dist;
            
            // Initial randomization
            sprite.position = new Vector3(x, 0, z);
            
            // Custom properties for lifecycle management
            sprite.metadata = {
                life: Math.random() * MAX_LIFETIME, // Random start time
                maxLife: MAX_LIFETIME,
                speed: 0.005 + Math.random() * 0.01,
                initialScale: 0.3 + Math.random() * 0.4,
                baseX: x,
                baseZ: z
            };

            sprite.width = sprite.metadata.initialScale;
            sprite.height = sprite.metadata.initialScale;

            // Initialize opacity
            sprite.color = new Color4(1, 1, 1, 0); 
            
            // Play animation (Frames 0-8, loop, 100ms delay)
            sprite.playAnimation(0, 8, true, 100);
            
            sprites.push(sprite);
        }

        // Animation loop for rising movement
        updateObserver = scene.onBeforeRenderObservable.add((scene, state) => {
            // Use deltaTime for smooth animation regardless of framerate
            // deltaTime is in milliseconds, convert to seconds
            const deltaTime = scene.getEngine().getDeltaTime() / 1000.0;

            sprites.forEach(s => {
                // Update lifetime
                s.metadata.life += deltaTime;

                // If life exceeds maxLife, reset
                if (s.metadata.life >= s.metadata.maxLife) {
                    s.metadata.life = 0;
                    // Reset position (keep random X/Z, reset Y)
                    // Optionally re-randomize X/Z for more variety, but keeping base is fine for stability
                    s.position.y = 0;
                }

                // Calculate progress (0.0 to 1.0)
                const progress = s.metadata.life / s.metadata.maxLife;

                // Update Y position: Rise steadily
                // Adjust speed factor if needed to match visual height preference
                // Let's say it rises 3 units over 3 seconds -> speed ~ 1 unit/sec
                // But we use per-particle speed. 
                // Let's rely on metadata.speed (which was ~0.01 per frame @60fps => ~0.6 units/sec)
                // Let's normalize it: y = speed * life_in_frames_approx? 
                // Let's just use speed * deltaTime * 60 to keep previous feel
                s.position.y += s.metadata.speed * (deltaTime * 60);

                // Update Opacity (Fade In / Fade Out)
                // Fade in first 20%, Fade out last 20%, Stay visible middle 60%
                let alpha = 0;
                if (progress < 0.2) {
                    // Fade In
                    alpha = progress / 0.2;
                } else if (progress > 0.8) {
                    // Fade Out
                    alpha = (1.0 - progress) / 0.2;
                } else {
                    // Full visibility (capped at 0.4 as requested previously)
                    alpha = 1.0;
                }
                
                // Max opacity is 0.4
                s.color.a = alpha * 0.4;
            });
        });
    };

    /**
     * Cleanup resources
     */
    const disposeParticles = () => {
        if (spriteManager) spriteManager.dispose();
        if (updateObserver) scene.onBeforeRenderObservable.remove(updateObserver);
    };

    return { initParticles, disposeParticles };
}
