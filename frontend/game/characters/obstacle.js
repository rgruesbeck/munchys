/**
 * game/character/obstacle.js
 * 
 * What it Does:
 *   This file is a basic obstacle character
 *   it extends the imageSprite class and adds two collision detections methods
 * 
 * What to Change:
 *   Add any character specific methods
 *   eg. eat
 * 
 */

import ImageSprite from '../objects/imageSprite.js';

class Obstacle extends ImageSprite {
    constructor(options) {
        super(options);

        this.type = options.type;
        this.active = true;
        this.munches = 0;
        this.bounds = {
            top: -200,
            right: 2000,
            left: -200,
            bottom: 2000
        };
    }

    munch() {
        this.munches += 1;
    }

    collisionsWith(entities) {
        let result = Object.entries(entities)
        .find((ent) => { return this.collidesWith(ent[1]); })
        ? true : false;

        return result;
    }

    collidesWith(entity) {
        let vx = entity.cx - this.cx;
        let vy = entity.cy - this.cy;
        let distance = Math.sqrt(vx * vx + vy * vy);
        return distance < (entity.radius + this.radius);
    }
}

export default Obstacle;