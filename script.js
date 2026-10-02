var gameStarted = false;
var gameCompleted = false;
var scene, camera, renderer, fpsController;
var currentLevelIndex = 0;
var deathsCount = 0;
var startTime = 0;
var elapsedTime = 0;

var knifeViewModel = null;
var isInspecting = false;
var inspectTime = 0;
const INSPECT_DURATION = 2.4;

const player = {
    position: new THREE.Vector3(0, 5, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    height: 1.6,
    radius: 0.45,
    onGround: false,
    wasOnGround: false,
    jumpsRemaining: 2,
    isTouchingWall: false,
    wallNormal: new THREE.Vector3(),
    activeCheckpoint: new THREE.Vector3(0, 5, 0),
    checkpointsReached: [false, false, false]
};

const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    sprint: false
};

var levelPlatforms = [];
var levelHazards = [];
var levelCheckpoints = [];
var levelPortal = null;
var levelAnimatedObjects = [];

function createPRNG(seed) {
    let s = seed;
    return function() {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

const BIOMES = [
    { name: "NEON CITY", bgColor: 0x06111e, fogColor: 0x06111e, color1: 0x3b82f6, color2: 0x1d4ed8, hazardColor: 0xef4444 },
    { name: "CIDADE ROOFTOP", bgColor: 0x0f172a, fogColor: 0x0f172a, color1: 0x475569, color2: 0x0284c7, hazardColor: 0xd97706 },
    { name: "FÁBRICA INDUSTRIAL", bgColor: 0x180f24, fogColor: 0x180f24, color1: 0x334155, color2: 0xec4899, hazardColor: 0xef4444 },
    { name: "TORRE CYBER", bgColor: 0x031d28, fogColor: 0x031d28, color1: 0x0f766e, color2: 0x06b6d4, hazardColor: 0x0284c7 },
    { name: "DESERTO SOLAR", bgColor: 0x221105, fogColor: 0x221105, color1: 0xd97706, color2: 0xf59e0b, hazardColor: 0xb45309 },
    { name: "ESTAÇÃO ESPACIAL", bgColor: 0x020617, fogColor: 0x020617, color1: 0x0284c7, color2: 0x38bdf8, hazardColor: 0x818cf8 },
    { name: "CAVERNA CRISTALINA", bgColor: 0x0b132b, fogColor: 0x0b132b, color1: 0x0d9488, color2: 0x14b8a6, hazardColor: 0x06b6d4 },
    { name: "VULCÃO SYNTH", bgColor: 0x2a080c, fogColor: 0x2a080c, color1: 0xe11d48, color2: 0xf43f5e, hazardColor: 0xbe123c },
    { name: "TEMPLO CELESTIAL", bgColor: 0x111827, fogColor: 0x111827, color1: 0xca8a04, color2: 0xeab308, hazardColor: 0xa16207 },
    { name: "DIMENSÃO ABISSAL", bgColor: 0x1e0624, fogColor: 0x1e0624, color1: 0xc084fc, color2: 0xd946ef, hazardColor: 0x9333ea }
];

function generate50Levels() {
    const levels = [];

    for (let i = 0; i < 50; i++) {
        const biomeIndex = Math.floor(i / 5);
        const biome = BIOMES[biomeIndex];
        const rng = createPRNG(i * 999 + 1234);

        const levelNumber = i + 1;
        const levelName = `${levelNumber} — ${biome.name} ${['I', 'II', 'III', 'IV', 'V'][i % 5]}`;

        const totalPlatforms = 12 + Math.floor(i * 0.5);
        const gapDistance = 10 + (i * 0.18);
        const platformMinSize = Math.max(3.5, 9 - (i * 0.1));

        levels.push({
            name: levelName,
            bgColor: biome.bgColor,
            fogColor: biome.fogColor,
            spawn: new THREE.Vector3(0, 3, 0),
            build: () => {
                let currentPos = new THREE.Vector3(0, 0, 0);

                addPlatform(currentPos.x, currentPos.y, currentPos.z, 12, 2, 12, biome.color1);

                const checkpointIndices = [
                    Math.floor(totalPlatforms * 0.25),
                    Math.floor(totalPlatforms * 0.50),
                    Math.floor(totalPlatforms * 0.75)
                ];

                let checkpointCounter = 0;

                for (let p = 1; p <= totalPlatforms; p++) {
                    const angle = (rng() - 0.5) * 1.2;
                    const dist = gapDistance + (rng() * 3);
                    const heightChange = (rng() - 0.4) * 4;

                    currentPos.x += Math.sin(angle) * dist;
                    currentPos.y += heightChange;
                    currentPos.z -= Math.cos(angle) * dist;

                    const width = Math.max(platformMinSize, 4 + rng() * 4);
                    const depth = Math.max(platformMinSize, 4 + rng() * 4);
                    const color = (p % 2 === 0) ? biome.color1 : biome.color2;

                    const isCheckpointStep = checkpointIndices.includes(p);
                    const isWall = !isCheckpointStep && (i >= 4 && p % 4 === 0 && rng() > 0.3);

                    if (isWall) {
                        addPlatform(currentPos.x, currentPos.y + 5, currentPos.z, 2, 14, depth + 4, biome.color2, true);
                    } else {
                        addPlatform(currentPos.x, currentPos.y, currentPos.z, width, 2, depth, color);
                    }

                    if (isCheckpointStep && checkpointCounter < 3) {
                        addCheckpoint(checkpointCounter, currentPos.x, currentPos.y + 1.1, currentPos.z);
                        checkpointCounter++;
                    }
                }

                currentPos.z -= 18;
                currentPos.y += 2;
                addPlatform(currentPos.x, currentPos.y, currentPos.z, 12, 2, 12, biome.color2);
                addPortal(currentPos.x, currentPos.y + 3.2, currentPos.z);

                addHazard(0, -25, currentPos.z / 2, 500, 2, Math.abs(currentPos.z) + 300, biome.hazardColor);
            }
        });
    }

    return levels;
}

const MAP_DEFINITIONS = generate50Levels();

function loadLevel(index) {
    currentLevelIndex = index;
    const def = MAP_DEFINITIONS[index];

    scene.background = new THREE.Color(def.bgColor);
    if (scene.fog) {
        scene.fog.color.setHex(def.fogColor);
    } else {
        scene.fog = new THREE.FogExp2(def.fogColor, 0.015);
    }

    clearCurrentLevel();
    def.build();

    player.position.set(0, 5, 0);
    player.activeCheckpoint.set(0, 5, 0);
    player.velocity.set(0, 0, 0);
    player.jumpsRemaining = 2;
    player.checkpointsReached = [false, false, false];

    camera.position.copy(player.position);

    document.getElementById('hud-level').innerText = `${index + 1}/50`;
    document.getElementById('hud-checkpoints').innerText = `0/3`;

    showToast(`Fase ${def.name} Carregada!`);
}

class SoundFX {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playJump() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(420, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }

    playDoubleJump() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
    }

    playTripleJump() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(950, this.ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.22);
    }

    playCheckpoint() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            gain.gain.setValueAtTime(0.2, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.3);
        });
    }

    playDeath() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playLevelComplete() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);
            gain.gain.setValueAtTime(0.3, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.5);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.5);
        });
    }

    playInspectSound() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(700, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.22);
    }
}

const sfx = new SoundFX();

class PointerLockFPSController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.isLocked = false;
        
        this.pitch = 0;
        this.yaw = 0;

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);

        document.addEventListener('pointerlockchange', this.onPointerLockChange);
    }

    connect() {
        this.domElement.addEventListener('click', () => this.lock());
    }

    lock() {
        this.domElement.requestPointerLock();
    }

    unlock() {
        document.exitPointerLock();
    }

    onPointerLockChange() {
        if (document.pointerLockElement === this.domElement) {
            this.isLocked = true;
            document.addEventListener('mousemove', this.onMouseMove, false);
            const pauseMenu = document.getElementById('pause-menu');
            if (pauseMenu) pauseMenu.classList.add('hidden');
        } else {
            this.isLocked = false;
            document.removeEventListener('mousemove', this.onMouseMove, false);
            if (typeof gameStarted !== 'undefined' && gameStarted && typeof gameCompleted !== 'undefined' && !gameCompleted) {
                const pauseMenu = document.getElementById('pause-menu');
                if (pauseMenu) pauseMenu.classList.remove('hidden');
            }
        }
    }

    onMouseMove(event) {
        if (!this.isLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        const sensitivity = 0.0022;

        this.yaw -= movementX * sensitivity;
        this.pitch -= movementY * sensitivity;

        const maxPitch = Math.PI / 2 - 0.02;
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

        this.updateCameraRotation();
    }

    updateCameraRotation() {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.x = this.pitch;
        euler.y = this.yaw;
        this.camera.quaternion.setFromEuler(euler);
    }

    getForwardVector() {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        return forward.normalize();
    }

    getRightVector() {
        const right = new THREE.Vector3(1, 0, 0);
        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        return right.normalize();
    }
}

function createKnifeAndHandModel() {
    const containerGroup = new THREE.Group();

    const goldLoreMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.92,
        roughness: 0.15,
        emissive: 0x553300,
        emissiveIntensity: 0.25
    });

    const blackHandleMat = new THREE.MeshStandardMaterial({
        color: 0x111315,
        roughness: 0.7,
        metalness: 0.2
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
        color: 0x22262a,
        metalness: 0.8,
        roughness: 0.3
    });

    const yellowGloveMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.6,
        metalness: 0.2
    });

    const gloveDarkTrimMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.85
    });

    const skinToneMat = new THREE.MeshStandardMaterial({
        color: 0xc48c66,
        roughness: 0.7
    });

    const goldWatchMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.9,
        roughness: 0.2
    });

    const karambitGroup = new THREE.Group();

    const ringGeo = new THREE.TorusGeometry(0.019, 0.005, 12, 24);
    const ringMesh = new THREE.Mesh(ringGeo, darkMetalMat);
    ringMesh.position.set(0, -0.09, 0);
    ringMesh.rotation.x = Math.PI / 2;
    karambitGroup.add(ringMesh);

    for (let i = 0; i < 5; i++) {
        const segGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.022, 10);
        const seg = new THREE.Mesh(segGeo, blackHandleMat);
        seg.position.set(Math.sin(i * 0.12) * 0.008, -0.07 + i * 0.02, 0);
        seg.rotation.z = -i * 0.08;
        karambitGroup.add(seg);
    }

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.quadraticCurveTo(0.04, 0.06, 0.08, 0.13);
    bladeShape.quadraticCurveTo(0.03, 0.08, -0.01, 0.02);
    bladeShape.lineTo(0, 0);

    const extrudeSettings = { depth: 0.004, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.002, bevelThickness: 0.002 };
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
    const bladeMesh = new THREE.Mesh(bladeGeo, goldLoreMat);
    bladeMesh.position.set(-0.005, 0.02, -0.002);
    bladeMesh.rotation.z = -Math.PI / 8;
    karambitGroup.add(bladeMesh);

    const handGroup = new THREE.Group();
    const palmGeo = new THREE.BoxGeometry(0.07, 0.08, 0.04);
    const palmMesh = new THREE.Mesh(palmGeo, yellowGloveMat);
    palmMesh.position.set(0, -0.05, -0.01);
    handGroup.add(palmMesh);

    const trimGeo = new THREE.BoxGeometry(0.072, 0.02, 0.042);
    const trimMesh = new THREE.Mesh(trimGeo, gloveDarkTrimMat);
    trimMesh.position.set(0, -0.08, -0.01);
    handGroup.add(trimMesh);

    const armGeo = new THREE.CylinderGeometry(0.035, 0.038, 0.18, 12);
    const armMesh = new THREE.Mesh(armGeo, skinToneMat);
    armMesh.position.set(0, -0.16, -0.01);
    handGroup.add(armMesh);

    const watchGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16);
    const watchMesh = new THREE.Mesh(watchGeo, goldWatchMat);
    watchMesh.position.set(0, -0.12, -0.01);
    handGroup.add(watchMesh);

    containerGroup.add(karambitGroup);
    containerGroup.add(handGroup);

    containerGroup.position.set(0.28, -0.22, -0.45);
    containerGroup.rotation.set(0.1, -0.2, 0.05);

    return containerGroup;
}

function triggerInspect() {
    if (!isInspecting && sfx) {
        isInspecting = true;
        inspectTime = 0;
        sfx.playInspectSound();
    }
}

function animateKnife(delta) {
    if (!knifeViewModel) return;

    if (isInspecting) {
        inspectTime += delta;
        const progress = inspectTime / INSPECT_DURATION;

        if (progress >= 1) {
            isInspecting = false;
            inspectTime = 0;
            knifeViewModel.rotation.set(0.1, -0.2, 0.05);
        } else {
            const spin = Math.sin(progress * Math.PI * 2) * Math.PI * 2;
            knifeViewModel.rotation.y = -0.2 + spin;
            knifeViewModel.rotation.x = 0.1 + Math.sin(progress * Math.PI) * 0.4;
        }
    } else {
        const time = Date.now() * 0.003;
        knifeViewModel.position.y = -0.22 + Math.sin(time) * 0.005;
        knifeViewModel.position.x = 0.28 + Math.cos(time * 0.5) * 0.003;
    }
}

function addPlatform(x, y, z, w, h, d, colorHex, isWall = false) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.3,
        metalness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    
    scene.add(mesh);

    levelPlatforms.push({
        mesh: mesh,
        box: new THREE.Box3().setFromObject(mesh),
        isWall: isWall
    });
}

function addHazard(x, y, z, w, h, d, colorHex) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    levelHazards.push({
        mesh: mesh,
        box: new THREE.Box3().setFromObject(mesh)
    });
}

function addCheckpoint(id, x, y, z) {
    const geo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    levelCheckpoints.push({
        id: id,
        mesh: mesh,
        pos: new THREE.Vector3(x, y, z),
        reached: false
    });
}

function addPortal(x, y, z) {
    const geo = new THREE.TorusGeometry(2, 0.25, 16, 32);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x7e22ce, emissiveIntensity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    levelPortal = {
        mesh: mesh,
        pos: new THREE.Vector3(x, y, z)
    };
    levelAnimatedObjects.push(mesh);
}

function clearCurrentLevel() {
    levelPlatforms.forEach(p => scene.remove(p.mesh));
    levelHazards.forEach(h => scene.remove(h.mesh));
    levelCheckpoints.forEach(c => scene.remove(c.mesh));
    if (levelPortal) scene.remove(levelPortal.mesh);

    levelPlatforms = [];
    levelHazards = [];
    levelCheckpoints = [];
    levelAnimatedObjects = [];
    levelPortal = null;
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast glass-panel px-6 py-3 rounded-full text-sm font-orbitron font-semibold text-cyan-300 shadow-xl border border-cyan-500/30';
    toast.innerText = msg;
    container.appendChild(toast);

    setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
    }, 3000);
}

function initEngine() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06111e, 0.015);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    fpsController = new PointerLockFPSController(camera, document.body);
    fpsController.connect();

    knifeViewModel = createKnifeAndHandModel();
    camera.add(knifeViewModel);
    scene.add(camera);

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') keys.forward = true;
        if (e.code === 'KeyS') keys.backward = true;
        if (e.code === 'KeyA') keys.left = true;
        if (e.code === 'KeyD') keys.right = true;
        if (e.code === 'ShiftLeft') keys.sprint = true;
        if (e.code === 'Space') {
            if (!keys.jump) keys.jumpPressed = true;
            keys.jump = true;
        }
        if (e.code === 'KeyF') triggerInspect();
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') keys.forward = false;
        if (e.code === 'KeyS') keys.backward = false;
        if (e.code === 'KeyA') keys.left = false;
        if (e.code === 'KeyD') keys.right = false;
        if (e.code === 'ShiftLeft') keys.sprint = false;
        if (e.code === 'Space') keys.jump = false;
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            sfx.init();
            document.getElementById('start-menu').classList.add('hidden');
            document.getElementById('hud-overlay').classList.remove('hidden');
            gameStarted = true;
            startTime = Date.now();
            loadLevel(0);
            fpsController.lock();
        });
    }

    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            fpsController.lock();
        });
    }

    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            document.getElementById('victory-screen').classList.add('hidden');
            gameCompleted = false;
            deathsCount = 0;
            startTime = Date.now();
            loadLevel(0);
            fpsController.lock();
        });
    }
}

function updatePhysics(delta) {
    if (!gameStarted || gameCompleted) return;

    const gravity = 28.0;
    const speed = keys.sprint ? 14.0 : 9.5;

    const moveDir = new THREE.Vector3();
    const forward = fpsController.getForwardVector();
    const right = fpsController.getRightVector();

    if (keys.forward) moveDir.add(forward);
    if (keys.backward) moveDir.sub(forward);
    if (keys.right) moveDir.add(right);
    if (keys.left) moveDir.sub(right);

    moveDir.y = 0;
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    player.velocity.x = moveDir.x * speed;
    player.velocity.z = moveDir.z * speed;

    player.velocity.y -= gravity * delta;

    if (keys.jumpPressed) {
        keys.jumpPressed = false;

        if (player.onGround) {
            player.velocity.y = 10.5;
            player.onGround = false;
            player.jumpsRemaining = 2;
            sfx.playJump();
        } else if (player.isTouchingWall) {
            player.velocity.y = 10.0;
            player.velocity.x += player.wallNormal.x * 8;
            player.velocity.z += player.wallNormal.z * 8;
            sfx.playJump();
        } else if (player.jumpsRemaining > 0) {
            player.velocity.y = 9.8;
            if (player.jumpsRemaining === 2) sfx.playDoubleJump();
            if (player.jumpsRemaining === 1) sfx.playTripleJump();
            player.jumpsRemaining--;
        }
    }

    player.position.x += player.velocity.x * delta;
    player.position.y += player.velocity.y * delta;
    player.position.z += player.velocity.z * delta;

    player.onGround = false;
    player.isTouchingWall = false;

    const playerBox = new THREE.Box3(
        new THREE.Vector3(player.position.x - player.radius, player.position.y - player.height, player.position.z - player.radius),
        new THREE.Vector3(player.position.x + player.radius, player.position.y, player.position.z + player.radius)
    );

    for (let p of levelPlatforms) {
        if (playerBox.intersectsBox(p.box)) {
            if (p.isWall) {
                player.isTouchingWall = true;
                player.wallNormal.set(player.position.x - p.mesh.position.x, 0, player.position.z - p.mesh.position.z).normalize();
            } else if (player.velocity.y <= 0 && player.position.y - player.velocity.y * delta >= p.box.max.y - 0.2) {
                player.position.y = p.box.max.y + player.height;
                player.velocity.y = 0;
                player.onGround = true;
                player.jumpsRemaining = 2;
            }
        }
    }

    for (let h of levelHazards) {
        if (playerBox.intersectsBox(h.box)) {
            deathsCount++;
            sfx.playDeath();
            player.position.copy(player.activeCheckpoint);
            player.velocity.set(0, 0, 0);
            document.getElementById('hud-deaths').innerText = deathsCount;
            showToast("Você caiu! Retornando ao Checkpoint...");
        }
    }

    levelCheckpoints.forEach(c => {
        if (!c.reached && player.position.distanceTo(c.pos) < 2.2) {
            c.reached = true;
            c.mesh.material.color.setHex(0x34d399);
            player.activeCheckpoint.copy(c.pos);

            const count = levelCheckpoints.filter(chk => chk.reached).length;
            document.getElementById('hud-checkpoints').innerText = `${count}/3`;
            sfx.playCheckpoint();
            showToast(`Checkpoint ${count}/3 Ativado!`);
        }
    });

    if (levelPortal && player.position.distanceTo(levelPortal.pos) < 2.5) {
        sfx.playLevelComplete();
        if (currentLevelIndex + 1 < MAP_DEFINITIONS.length) {
            loadLevel(currentLevelIndex + 1);
        } else {
            gameCompleted = true;
            fpsController.unlock();
            document.getElementById('hud-overlay').classList.add('hidden');
            document.getElementById('victory-screen').classList.remove('hidden');

            const totalSeconds = Math.floor(elapsedTime / 1000);
            const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const secs = String(totalSeconds % 60).padStart(2, '0');
            const ms = String(elapsedTime % 1000).padStart(3, '0');

            document.getElementById('vic-time').innerText = `${mins}:${secs}.${ms}`;
            document.getElementById('vic-deaths').innerText = deathsCount;
        }
    }

    camera.position.copy(player.position);
}

function updateHUD() {
    if (!gameStarted || gameCompleted) return;

    elapsedTime = Date.now() - startTime;
    const totalSeconds = Math.floor(elapsedTime / 1000);
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    const ms = String(elapsedTime % 1000).padStart(3, '0');

    document.getElementById('hud-timer').innerText = `${mins}:${secs}.${ms}`;

    const horizSpeed = Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2);
    document.getElementById('hud-speed').innerText = `${Math.round(horizSpeed * 3.6)} KM/H`;
}

var lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    updatePhysics(delta);
    animateKnife(delta);

    levelAnimatedObjects.forEach(obj => {
        obj.rotation.z += delta * 1.5;
        obj.rotation.x += delta * 0.8;
    });

    updateHUD();

    renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
    initEngine();
    animate();
});