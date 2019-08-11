/**
 * game/objects/effects.js
 * 
 * What it Does:
 *   This file contains effects for the game
 * 
 *   burst: get a particle burst
 * 
 * What to Change:
 *   Add any new methods that don't fit anywhere else
 *   eg. 
 * 
 */

 import colorConvert from 'color-convert';

import {
    randomBetween,
    pickFromList,
    valueOrRange
} from '../utils/baseUtils.js';

const imagePraticleEmitter = ({ n = 1, x = 0, y = 0, vx = 1, vy = 1, r = 0, rd = 50, image }) => {
    return Array.apply(null, { length: n })
    .map(() => { return {
        image: image,
        x: valueOrRange(x),
        y: valueOrRange(y),
        r: valueOrRange(r),
        rd: valueOrRange(rd),
        vx: valueOrRange(vx),
        vy: valueOrRange(vy),
        dr: pickFromList([1, -1])
    }; });
}

const praticleEmitter = ({ n = 1, x = 0, y = 0, vx = 1, vy = 1, rd = 2, hue = 0, alpha = 1 }) => {
    return Array.apply(null, { length: n })
    .map(() => { return {
        x: valueOrRange(x),
        y: valueOrRange(y),
        vx: valueOrRange(vx),
        vy: valueOrRange(vy),
        rd: valueOrRange(rd),
        hue: valueOrRange(hue),
        alpha: valueOrRange(alpha)
    }; });
}

const radialWaveEmitter = ({ n = 1, x = 0, y = 0, rd = 2, width = 50, hue = 0, alpha = 1 }) => {
    return Array.apply(null, { length: n })
    .map(() => { return {
        x: valueOrRange(x),
        y: valueOrRange(y),
        width: valueOrRange(width),
        rd: valueOrRange(rd),
        hue: valueOrRange(hue),
        alpha: valueOrRange(alpha)
    }; });
}

const drawParticle = (ctx, p) => {
    ctx.beginPath();
    ctx.arc(p.x >> 0, p.y >> 0, p.rd >> 0, 0, 2 * Math.PI, false);
    ctx.fillStyle = `hsla(${p.hue}, 100%, 50%, ${p.alpha})`;
    ctx.fill();
}

const drawImageParticle = (ctx, p) => {
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.translate(-p.x, -p.y);
    ctx.drawImage(p.image, p.x, p.y, p.rd * 2, p.rd * 2);
    ctx.translate(p.x, p.y);
    ctx.rotate(-p.r);
    ctx.translate(-p.x, -p.y);
}

const drawWave = (ctx, w) => {
    ctx.beginPath();
    ctx.arc(w.x >> 0, w.y >> 0, w.rd >> 0, 0, 2 * Math.PI);
    ctx.lineWidth = w.width;
    ctx.strokeStyle = `hsla(${w.hue}, 100%, 50%, ${w.alpha})`;
    ctx.stroke();
}

function Burst({ ctx, n = 10, image, x, y, vx, vy, burnRate }) {
    this.id = Math.random().toString(16).slice(2);
    this.type = 'burst';
    this.active = true;
    this.ctx = ctx;
    this.center = { x, y };
    this.burnRate = burnRate;

    this.shards = imagePraticleEmitter({
        n: n,
        image: image,
        x: x,
        y: y,
        r: 0,
        vx: vx || [-10, 10],
        vy: vy || [-10, 10],
        rd: [5, 20],
    });

    this.tick = () => {
        // only tick if active
        if (!this.active) { return; }

        // flag as in-active when no more shards
        if (this.shards.length === 0) {
            this.active = false;
            return;
        }

        // loop through burst shards
        for (let i = 0; i < this.shards.length; i++) {
            let shard = this.shards[i];

            // update position
            shard.x += shard.vx;
            shard.y += shard.vy;
            shard.r += (0.1 * shard.dr);

            // update size and color
            shard.rd = Math.abs(shard.rd - this.burnRate);

            // remove burned shards
            if (shard.rd < 1) {
                this.shards.splice(i, 1);
            }

            // draw shard
            drawImageParticle(this.ctx, shard);
        }
    }
}

function BlastWave({ ctx, x, y, width = 50, color, burnRate = 100 }) {
    this.id = Math.random().toString(16).slice(2);
    this.type = 'blast-wave';
    this.active = true;
    this.ctx = ctx;
    this.center = { x, y };
    this.burnRate = (Array.isArray(burnRate) ? randomBetween(burnRate[0], burnRate[1]) : burnRate) / 100;
    this.color = {
        hex: color,
        rgb: colorConvert.hex.rgb(color),
        hsl: colorConvert.hex.hsl(color)
    }

    this.waves = radialWaveEmitter({
        x: x,
        y: y,
        rd: 25,
        width: width,
        hue: this.color.hsl[0],
        alpha: 1
    })

    this.tick = () => {
        // only tick if active
        if (!this.active) { return; }

        // flag as in-active when no more waves
        if (this.waves.length === 0) {
            this.active = false;
            return;
        }

        // loop through waves 
        for (let i = 0; i < this.waves.length; i++) {
            let wave = this.waves[i];

            // draw waves
            wave.rd += this.burnRate * 8;
            wave.width -= this.burnRate / 2;
            wave.hue -= this.burnRate / 2;
            wave.alpha -= this.burnRate * 0.0075;

            // remove wave when larger than blast radius
            if (wave.width < 1) {
                this.waves.splice(i, 1);
            }

            // draw wave
            drawWave(this.ctx, wave);
        }

    }
}

export {
    Burst,
    BlastWave
};
