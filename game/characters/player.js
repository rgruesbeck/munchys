/**
 * game/character/player.js
 * 
 * What it Does:
 *   This file is a basic player character
 *   it extends the imageSprite class and adds two collision detections methods
 * 
 * What to Change:
 *   Add any character specific methods
 *   eg. eat
 * 
 */

import { bounded } from '../utils/baseUtils.js';
import ImageSprite from '../objects/imageSprite.js';

class Player extends ImageSprite {
    constructor(options) {
        super(options);

        this.originalWidth = options.width;
        this.originalHeight = options.height;

        this.images = options.images;
    }

    update() {
        // update player image
        let max = this.ctx.canvas.width / 2; // get max player width
        let i = (this.width / max) * this.images.length; // get index matching width
        let idx = bounded(Math.round(i) - 1, 0, this.images.length - 1)
        this.image = this.images[idx]; // set player image
    }

    eat() {
        // eat food
        this.width += 1;
        this.height += 1;
        this.radius = (this.width + this.height) / 4;

        this.update();
    }

    blaze() {
        // get munchies
        this.width = this.originalWidth
        this.height = this.originalHeight;

        this.update();
    }
}

export default Player;