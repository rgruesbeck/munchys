/**
 * game/main.js
 * 
 * What it Does:
 *   This file is the main game class
 *   Important parts are the load, create, and play functions
 *   
 *   Load: is where images, sounds, and fonts are loaded
 *   
 *   Create: is where game elements and characters are created
 *   
 *   Play: is where game characters are updated according to game play
 *   before drawing a new frame to the screen, and calling play again
 *   this creates an animation just like the pages of a flip book
 * 
 *   Other parts include boilerplate for requesting and canceling new frames
 *   handling input events, pausing, muting, etc.
 * 
 * What to Change:
 *   Most things to change will be in the play function
 */

import Koji from 'koji-tools';

import {
    requestAnimationFrame,
    cancelAnimationFrame
} from './helpers/animationFrame.js';

import {
    loadList,
    loadImage,
    loadSound,
    loadFont
} from 'game-asset-loader';

import audioContext from 'audio-context';
import audioPlayback from 'audio-play';
import unlockAudioContext from 'unlock-audio-context';

import preventParent from 'prevent-parent';

import {
    hashCode,
    randomBetween,
    bounded,
    throttled,
    pickFromList
} from './utils/baseUtils.js';

import {
    resize
} from './utils/imageUtils.js';

import {
    getDistance
} from './utils/spriteUtils.js';

import {
    canvasInputPosition
} from './utils/inputUtils.js';

import {
    Burst,
    BlastWave,
} from './objects/effects.js';

import Player from './characters/player.js';
import Obstacle from './characters/obstacle.js';
import { collideDistance } from './utils/spriteUtils.js';

class Game {

    constructor(canvas, container, overlay, topbar, config) {
        this.config = config; // customization
        this.container = container; // container
        this.overlay = overlay; // overlay

        // set topbar
        this.topbar = topbar;
        this.topbar.active = config.settings.gameTopBar;

        // prevent parent window form scrolling
        preventParent();

        this.prefix = hashCode(this.config.settings.name); // set prefix for local-storage keys

        this.canvas = canvas; // game screen
        this.ctx = canvas.getContext("2d"); // game screen context

        this.audioCtx = audioContext(); // create new audio context
        unlockAudioContext(this.audioCtx);
        this.playlist = [];

        // setup throttled functions
        this.throttledBlastWave = throttled(600, (bw) => new BlastWave(bw));
        this.throttledBurst = throttled(300, (br) => new Burst(br));
        this.throttledPlayback = throttled(300, (key, buffer) => this.playback(key, buffer));

        // setup event listeners
        // handle keyboard events
        document.addEventListener('keydown', ({ code }) => this.handleKeyboardInput('keydown', code));
        document.addEventListener('keyup', ({ code }) => this.handleKeyboardInput('keyup', code));

        // handle taps
        document.addEventListener('touchstart', (e) => this.handleTap('start', e));

        // handle overlay clicks
        this.overlay.root.addEventListener('click', (e) => this.handleClicks(e));

        // handle resize events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener("orientationchange", (e) => this.handleResize(e));

        // handle koji config changes
        Koji.on('change', (scope, key, value) => {
            this.config[scope][key] = value;
            this.cancelFrame(this.frame.count - 1);
            this.load();
        });

    }

    init() {
        // set canvas
        this.canvas.width = window.innerWidth; // set game screen width
        this.canvas.height = this.topbar.active ? window.innerHeight - this.topbar.clientHeight : window.innerHeight; // set game screen height

        // frame count, rate, and time
        // this is just a place to keep track of frame rate (not set it)
        this.frame = {
            count: 0,
            time: Date.now(),
            rate: null,
            scale: null
        };

        // game settings
        this.playerSize = parseInt(this.config.settings.playerSize);
        this.obstacleSize = parseInt(this.config.settings.obstacleSize);

        this.state = {
            current: 'loading',
            prev: '',
            score: 0,
            gameSpeed: parseInt(this.config.settings.gameSpeed),
            paused: false,
            muted: localStorage.getItem(this.prefix.concat('muted')) === 'true'
        };

        this.input = {
            left: false,
            right: false
        };

        this.images = {}; // place to keep images
        this.sounds = {}; // place to keep sounds
        this.fonts = {}; // place to keep fonts

        this.effects = []; // effects
        this.entities = []; // entities (obstacles, powerups)
        this.player = {}; // player

        // set topbar and topbar color
        this.topbar.active = this.config.settings.gameTopBar;
        this.topbar.style.display = this.topbar.active ? 'block' : 'none';
        this.topbar.style.backgroundColor = this.config.colors.primaryColor;


        // set screen
        this.screen = {
            top: 0,
            bottom: this.canvas.height,
            left: 0,
            right: this.canvas.width,
            centerX: this.canvas.width / 2,
            centerY: this.canvas.height / 2,
            scale: ((this.canvas.width + this.canvas.height) / 2) / 1000,
            scaleWidth: (this.canvas.width / 2) / 1000,
            scaleHeight: (this.canvas.height / 2) / 1000,
            minSize: ((this.canvas.width + this.canvas.height) / 2) / 20,
            maxSize: ((this.canvas.width + this.canvas.height) / 2) / 10 
        };

        // set document body to backgroundColor
        document.body.style.backgroundColor = this.config.colors.backgroundColor;

        // set loading indicator to textColor
        document.querySelector('#loading').style.color = this.config.colors.textColor;

    }

    load() {
        // load pictures, sounds, and fonts
        this.init();

        if (this.state.backgroundMusic) { this.state.backgroundMusic.pause(); } // stop background music when re-loading

        // make a list of assets
        const gameAssets = [
            loadImage('dizzyFaceImage', this.config.images.dizzyFaceImage),
            loadImage('happyFaceImage', this.config.images.happyFaceImage),
            loadImage('hungryFaceImage', this.config.images.hungryFaceImage),
            loadImage('fullFaceImage', this.config.images.fullFaceImage),
            loadImage('sickFaceImage', this.config.images.sickFaceImage),
            loadImage('foodImage1', this.config.images.foodImage1),
            loadImage('foodImage2', this.config.images.foodImage2),
            loadImage('foodImage3', this.config.images.foodImage3),
            loadImage('foodImage4', this.config.images.foodImage4),
            loadImage('weedImage', this.config.images.weedImage),
            loadImage('backgroundImage', this.config.images.backgroundImage, { optional: true }),
            loadSound('backgroundMusic', this.config.sounds.backgroundMusic),
            loadSound('munchSound', this.config.sounds.munchSound),
            loadSound('clearSound', this.config.sounds.clearSound),
            loadSound('gameOverSound', this.config.sounds.gameOverSound),
            loadFont('gameFont', this.config.settings.fontFamily)
        ];

        // put the loaded assets the respective containers
        loadList(gameAssets, (progress) => {

            document.getElementById('loading-progress').textContent = `${progress.percent}%`;
        })
        .then((assets) => {

            this.images = assets.image;
            this.sounds = assets.sound;

        })
        .then(() => this.create())
        .catch(err => console.error(err));
    }

    create() {
        // create game characters
        const { top } = this.screen;
        const {
            dizzyFaceImage,
            happyFaceImage,
            hungryFaceImage,
            fullFaceImage,
            sickFaceImage,
            foodImage1
        } = this.images;

        // set player size
        let playerWidth = bounded(this.playerSize * this.screen.scaleHeight, this.screen.minSize, this.screen.maxSize);
        this.playerSize = resize({
            image: dizzyFaceImage,
            width: playerWidth
        });


        let playerX = this.screen.centerX;

        this.player = new Player({
            ctx: this.ctx,
            image: dizzyFaceImage,
            images: [
                dizzyFaceImage,
                happyFaceImage,
                hungryFaceImage,
                fullFaceImage,
                sickFaceImage,
            ],
            x: playerX,
            y: top,
            width: this.playerSize.width,
            height: this.playerSize.height,
            speed: this.playerSize.width,
            bounds: this.screen
        });

        // set obstacle size
        let obstacleWidthOpen = bounded(this.obstacleSize * this.screen.scaleHeight, this.screen.minSize, this.screen.maxSize);
        this.obstacleSize = resize({
            image: foodImage1,
            width: obstacleWidthOpen
        });

        // set overlay styles
        this.overlay.setStyles({...this.config.colors, ...this.config.settings});

        this.setState({ current: 'ready' });
        this.play();
    }

    play() {
        // update game characters

        // clear the screen of the last picture
        this.ctx.fillStyle = this.config.colors.backgroundColor; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // draw and do stuff that you need to do
        // no matter the game state
        this.ctx.drawImage(this.images.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);

        // update score
        this.overlay.setScore(this.state.score);

        // ready to play
        if (this.state.current === 'ready') {

            // display menu after loading or game over
            if (this.state.prev.match(/loading|over/)) {
                this.overlay.hide('loading');
                this.canvas.style.opacity = 1;

                this.overlay.setBanner(this.config.settings.name);
                this.overlay.setButton(this.config.settings.startText);
                this.overlay.setInstructions({
                    desktop: this.config.settings.instructionsDesktop,
                    mobile: this.config.settings.instructionsMobile
                });

                this.overlay.show('stats');

                this.overlay.setMute(this.state.muted);
                this.overlay.setPause(this.state.paused);

                this.setState({ current: 'ready' });
            }

        }

        // game play
        if (this.state.current === 'play') {

            // if last state was 'ready'
            // hide overlay items
            if (this.state.prev === 'ready') {
                this.overlay.hide(['banner', 'button', 'instructions'])

                this.setState({ current: 'play' });
            }

            if (!this.state.muted && this.playlist.length === 0) {
                this.playback('backgroundMusic', this.sounds.backgroundMusic, { loop: true })
            }


            // add an obstacle
            let munchTime = this.frame.count % 600 === 0;
            let shouldAddObstacle = this.entities.length < 6; // less than some number of obstacles ( max is 6 )
            if (munchTime || shouldAddObstacle) {
                // pick a location
                let location = {
                    x: randomBetween(0, this.screen.right - this.obstacleSize.width, true),
                    y: -200
                };

                // ignore crowded locations
                let inValidLocation = this.entities.some((ent) => {
                    return getDistance(ent, location) < this.playerSize.width * 3;
                });


                // add food
                if (!inValidLocation && !munchTime) {
                    // add new obstacle
                    let {foodImage1, foodImage2, foodImage3, foodImage4 } = this.images;
                    let obstacleSize = resize({
                        image: foodImage1,
                        width: this.obstacleSize.width
                    });

                    this.entities.push(new Obstacle({
                        ctx: this.ctx,
                        type: 'food',
                        image: pickFromList([foodImage1, foodImage2, foodImage3, foodImage4]),
                        x: location.x,
                        y: location.y,
                        width: obstacleSize.width,
                        height: obstacleSize.height,
                        speed: this.state.gameSpeed,
                        bounds: this.screen
                    }))
                }

                // munch time
                if (!inValidLocation && munchTime) {
                    // munch time
                    let { weedImage } = this.images;
                    let obstacleSize = resize({
                        image: weedImage,
                        width: this.obstacleSize.width
                    });

                    this.entities.push(new Obstacle({
                        ctx: this.ctx,
                        type: 'weed',
                        image: weedImage,
                        x: location.x,
                        y: location.y,
                        width: obstacleSize.width,
                        height: obstacleSize.height,
                        speed: this.state.gameSpeed,
                        bounds: this.screen
                    }))
                }
            }

            // update and draw effects
            for (let i = 0; i < this.effects.length; i++) {
                let effect = this.effects[i];

                // run effect tick
                effect.tick();

                // remove in-active effects
                if (!effect.active) {
                    this.effects.splice(i, 1);
                }
                
            }

            for (let i = 0; i < this.entities.length; i++) {
                let entity = this.entities[i];
                let dx = Math.cos(this.frame.count / 60) / 6;

                entity.move(dx, 1, this.frame.scale);
                entity.draw();

                // check for player collisions
                if (collideDistance(entity, this.player)) {
                    // handle collision
                    entity.munch();
                    
                    // add points & increase game speed
                    this.setState({
                        score: this.state.score + 1
                    });

                    // eat
                    if (entity.type === 'food') {
                        this.player.eat();
                        this.throttledPlayback('munchSound', this.sounds.munchSound);

                        this.effects.push(
                            new Burst({
                                ctx: this.ctx,
                                image: entity.image,
                                n: 1,
                                x: [this.player.x, this.player.x + this.player.width],
                                y: [this.player.y, this.player.y + this.player.height],
                                vx: [-5, 5],
                                vy: [-10, 1],
                                burnRate: 0.025
                            })
                        );
                    }

                    // blaze
                    if (entity.type === 'weed') {
                        this.player.blaze();
                        this.throttledPlayback('clearSound', this.sounds.clearSound);

                        this.effects.push(
                            new Burst({
                                ctx: this.ctx,
                                image: entity.image,
                                n: 20,
                                x: [this.player.x, this.player.x + this.player.width],
                                y: [this.player.y, this.player.y + this.player.height],
                                vx: [-5, 5],
                                vy: [-10, 1],
                                burnRate: 0.01
                            })
                        );
                    }

                }

                // remove in-active entity
                if (entity.y > this.canvas.height || entity.munches > 5) {
                    this.entities.splice(i, 1);
                }
                
            }


            // check for game over
            if (this.player.width > this.canvas.width / 2) {
                // big explosion
                this.effects.push(
                    new Burst({
                        ctx: this.ctx,
                        image: this.images.weedImage,
                        n: 200,
                        x: [this.player.x, this.player.x + this.player.width],
                        y: [this.player.y, this.player.y + this.player.height],
                        vx: [-5, 5],
                        vy: [-10, 1],
                        burnRate: 0.01
                    })
                );

                this.playback('gameOverSound', this.sounds.gameOverSound);
                this.stopPlayback('backgroundMusic');

                // game over
                this.setState({ current: 'over' });
            }

            // player bounce
            let dy = Math.cos(this.frame.count / 5) / 30;

            // move player: open play
            let { left, right } = this.input;
            let dx = (left ? -1 : 0) + (right ? 1 : 0);

            // apply movement
            this.player.move(dx, dy, this.frame.scale);
            this.player.moveTo({
                y: this.screen.bottom - this.player.height
            }); 
            this.player.draw();
        }

        // game over
        if (this.state.current === 'over') {

            // update and draw effects
            for (let i = 0; i < this.effects.length; i++) {
                let effect = this.effects[i];

                // run effect tick
                effect.tick();

                // remove in-active effects
                if (!effect.active) {
                    this.effects.splice(i, 1);
                }
                
            }

            setTimeout(() => {
                window.setScore(this.state.score);
                window.setAppView('setScore');
            }, 1000);

        }

        // draw the next screen
        if (this.state.current === 'stop') {
            this.cancelFrame();
        } else {
            this.requestFrame(() => this.play());
        }
    }

    // event listeners
    handleClicks(e) {
        if (this.state.current === 'loading') { return; }

        let { target } = e;

        // mute
        if (target.id === 'mute') {
            this.mute();
        }

        // pause
        if (target.id === 'pause') {
            this.pause();
        }

        // button
        if ( target.id === 'button') {

            this.setState({ current: 'play' });
        }

    }

    handleTap(type, e) {
        // ignore for first 1 second
        if (this.frame.count < 60) { return; }

        // shift right for right of player taps
        // shift left for left of player taps
        if (type === 'start') {
            let location = canvasInputPosition(this.canvas, e.touches[0]);

            if (location.x > this.screen.centerX) {
                this.input.right = true;
                this.input.left = false;
            }

            if (location.x < this.screen.centerX) {
                this.input.left = true;
                this.input.right = false;
            }
        }

        if (type === 'end') {
            this.input.right = false;
            this.input.left = false;
        }
    }

    handleKeyboardInput(type, code) {
        if (type === 'keydown' && this.state.current === 'play') {
            if (code === 'ArrowRight') {
                this.input.right = true;
            }
            if (code === 'ArrowLeft') {
                this.input.left = true;
            }
        }

        if (type === 'keyup' && this.state.current === 'play') {
            if (code === 'ArrowRight') {
                this.input.right = false;
            }
            if (code === 'ArrowLeft') {
                this.input.left = false;
            }

            if (code === 'Space') {

                this.pause(); // pause
            }
        }

        // start game on read
        if (type === 'keydown' && this.state.current === 'ready') {
            this.setState({ current: 'play' });
        }

        // reload on game over
        if (type === 'keydown' && this.state.current === 'over') {
            this.effects.length === 1 && this.load();
        }

    }

    handleResize() {

        // document.location.reload();
    }

    // method:pause pause game
    pause() {
        if (this.state.current != 'play') { return; }

        this.state.paused = !this.state.paused;
        this.overlay.setPause(this.state.paused);

        if (this.state.paused) {
            // pause game loop
            this.cancelFrame(this.frame.count - 1);

            // mute all game sounds
            this.audioCtx.suspend();

            this.overlay.setBanner('Paused');
        } else {
            // resume game loop
            this.requestFrame(() => this.play(), true);

            // resume game sounds if game not muted
            if (!this.state.muted) {
                this.audioCtx.resume();
            }

            this.overlay.hide('banner');
        }
    }

    // method:mute mute game
    mute() {
        let key = this.prefix.concat('muted');
        localStorage.setItem(
            key,
            localStorage.getItem(key) === 'true' ? 'false' : 'true'
        );
        this.state.muted = localStorage.getItem(key) === 'true';

        this.overlay.setMute(this.state.muted);

        if (this.state.muted) {
            // mute all game sounds
            this.audioCtx.suspend();
        } else {
            // unmute all game sounds
            if (!this.state.paused) {
                this.audioCtx.resume();
            }
        }
    }

    // method:playback
    playback(key, audioBuffer, options = {}) {
        if (this.state.muted) { return; }

        // add to playlist
        let id = Math.random().toString(16).slice(2);
        this.playlist.push({
            id: id,
            key: key,
            playback: audioPlayback(audioBuffer, {
                ...{
                    start: 0,
                    end: audioBuffer.duration,
                    context: this.audioCtx
                },
                ...options
            }, () => {
                // remove played sound from playlist
                this.playlist = this.playlist
                    .filter(s => s.id != id);
            })
        });
    }

    // method:stopPlayBack
    stopPlayback(key) {
        this.playlist = this.playlist
        .filter(s => {
            let targetBuffer = s.key === key;
            if (targetBuffer) {
                s.playback.pause();
            }
            return targetBuffer;
        })
    }

    stopPlaylist() {
        this.playlist
        .forEach(s => this.stopPlayback(s.key))
    }

    // reset game
    reset() {

        // document.location.reload();
    }

    // update game state
    setState(state) {
        this.state = {
            ...this.state,
            ...{ prev: this.state.current },
            ...state,
        };
    }

    // request new frame
    // wraps requestAnimationFrame.
    // see game/helpers/animationframe.js for more information
    requestFrame(next, resumed) {
        let now = Date.now();
        this.frame = {
            count: requestAnimationFrame(next),
            time: now,
            rate: resumed ? 0 : now - this.frame.time,
            scale: this.screen.scale * this.frame.rate * 0.01
        };
    }

    // cancel frame
    // wraps cancelAnimationFrame.
    // see game/helpers/animationframe.js for more information
    cancelFrame() {
        cancelAnimationFrame(this.frame.count);
    }

    destroy() {
        // stop game loop and music
        this.setState({ current: 'stop' })
        this.stopPlaylist();

        // cleanup event listeners
        document.removeEventListener('keydown', this.handleKeyboardInput);
        document.removeEventListener('keyup', this.handleKeyboardInput);
        document.removeEventListener('touchstart', this.handleTap);
        this.overlay.root.removeEventListener('click', this.handleClicks);
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener("orientationchange", this.handleResize);

        // cleanup nodes
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
    }
}

export default Game;