/* ============================================================
   HARDY FC — Meridian League. Original football game.
   v0.3: player ratings, play styles, tactics & formations,
   transfer market with budget & contracts, rotating opponents,
   seasons with prize money. All content is fictional.
   ============================================================ */

(function () {
'use strict';

// ---------- Constants ----------
var FIELD_L = 105, FIELD_W = 68;
var HALF_L = FIELD_L / 2, HALF_W = FIELD_W / 2;
var GOAL_W = 7.32, GOAL_H = 2.44, POST_R = 0.06;
var BOX_D = 16.5, BOX_W = 20.16;
var BALL_R = 0.11;
var GRAVITY = -9.81;
var HALF_REAL_SECONDS = 240;

// ---------- Helpers ----------
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function rand(a, b) { return a + Math.random() * (b - a); }
function irand(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function dist2d(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function fmtM(m) { return '£' + (Math.round(m * 10) / 10) + 'M'; }

// ---------- Renderer / scene ----------
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1a2b);
scene.fog = new THREE.Fog(0x0d1a2b, 160, 340);

var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;      // filmic broadcast look
renderer.toneMappingExposure = 1.12;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.insertBefore(renderer.domElement, document.body.firstChild);

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

var hemi = new THREE.HemisphereLight(0xbfd6ff, 0x2a4020, 0.85);
scene.add(hemi);
var sun = new THREE.DirectionalLight(0xfff3e0, 1.35);
sun.position.set(-60, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.camera.far = 250;
scene.add(sun);

// ---------- Sky dome ----------
function skyTexture(kind) {
  var c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  var g = c.getContext('2d');
  var grad = g.createLinearGradient(0, 0, 0, 256);
  if (kind === 'night') {
    grad.addColorStop(0, '#020408');
    grad.addColorStop(0.55, '#0a1226');
    grad.addColorStop(1, '#131c33');
  } else if (kind === 'rain') {
    grad.addColorStop(0, '#4a5560');
    grad.addColorStop(0.6, '#6a7681');
    grad.addColorStop(1, '#8a949c');
  } else {
    grad.addColorStop(0, '#1e63b8');
    grad.addColorStop(0.6, '#5a9bdc');
    grad.addColorStop(1, '#a8cdea');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  if (kind === 'night') {
    g.fillStyle = '#ffffff';
    for (var i = 0; i < 90; i++) {
      g.globalAlpha = rand(0.3, 1);
      g.fillRect(Math.random() * 64, Math.random() * 150, 1, 1);
    }
    g.globalAlpha = 1;
  } else if (kind !== 'rain') {
    // soft clouds
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (var j = 0; j < 10; j++) {
      var cy = rand(30, 120);
      g.beginPath();
      g.ellipse(Math.random() * 64, cy, rand(8, 18), rand(2, 5), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  var t = new THREE.CanvasTexture(c);
  return t;
}
var SKY_TEX = { day: skyTexture('day'), night: skyTexture('night'), rain: skyTexture('rain') };
var skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(320, 24, 16),
  new THREE.MeshBasicMaterial({ map: SKY_TEX.day, side: THREE.BackSide, fog: false })
);
scene.add(skyDome);

// ---------- Weather & day/night ----------
var weather = { rain: false, night: false };
var rainPoints = (function () {
  var N = 900;
  var geo = new THREE.BufferGeometry();
  var pos = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) {
    pos[i * 3] = rand(-70, 70);
    pos[i * 3 + 1] = rand(0, 40);
    pos[i * 3 + 2] = rand(-50, 50);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xaaccee, size: 0.14, transparent: true, opacity: 0.55
  }));
  pts.visible = false;
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();
function rollWeather() {
  weather.rain = Math.random() < 0.28;
  weather.night = Math.random() < 0.35;
  var g = Math.random();
  weather.grass = g < 0.25 ? 'short' : g < 0.85 ? 'normal' : 'long';
  applyWeather();
}
function applyWeather() {
  if (weather.night) {
    scene.background = new THREE.Color(0x05080f);
    scene.fog.color.set(0x05080f);
    hemi.intensity = 0.55;
    sun.intensity = 1.0;
    sun.color.set(0xdfe9ff);          // floodlights
  } else {
    scene.background = new THREE.Color(0x0d1a2b);
    scene.fog.color.set(0x0d1a2b);
    hemi.intensity = weather.rain ? 0.7 : 0.85;
    sun.intensity = weather.rain ? 1.1 : 1.35;
    sun.color.set(weather.rain ? 0xe8eef5 : 0xfff3e0);
  }
  rainPoints.visible = weather.rain;
  floodHeads.forEach(function (h) { h.material.color.set(weather.night ? 0xfff8d0 : 0x37474f); });
  skyDome.material.map = weather.night ? SKY_TEX.night : (weather.rain ? SKY_TEX.rain : SKY_TEX.day);
  skyDome.material.needsUpdate = true;
}
function weatherLabel() {
  var bits = [];
  bits.push(weather.night ? '🌙 Night' : '☀ Day');
  if (weather.rain) bits.push('🌧 Rain');
  if (weather.grass === 'short') bits.push('🌱 fresh short cut — quick surface');
  if (weather.grass === 'long') bits.push('🌿 long grass — slow surface');
  return bits.join(' · ');
}
function updateRain(dt) {
  if (!weather.rain) return;
  var arr = rainPoints.geometry.attributes.position.array;
  for (var i = 0; i < arr.length; i += 3) {
    arr[i + 1] -= 34 * dt;
    if (arr[i + 1] < 0) {
      arr[i + 1] = rand(28, 40);
      arr[i] = camera.position.x + rand(-60, 60);
      arr[i + 2] = camera.position.z + rand(-70, 20);
    }
  }
  rainPoints.geometry.attributes.position.needsUpdate = true;
}

// ---------- Pitch (real CC0 grass photo + mow stripes + painted lines) ----------
function paintPitchCanvas(c, grassImg) {
  var g = c.getContext('2d');
  var sx = c.width / FIELD_L, sz = c.height / FIELD_W;
  if (grassImg) {
    var pat = g.createPattern(grassImg, 'repeat');
    g.fillStyle = pat;
    g.fillRect(0, 0, c.width, c.height);
    // tint the photo turf toward broadcast green
    g.fillStyle = 'rgba(30,110,40,0.35)';
    g.fillRect(0, 0, c.width, c.height);
  } else {
    g.fillStyle = '#2f7d33';
    g.fillRect(0, 0, c.width, c.height);
  }
  // mow stripes over the top
  for (var i = 0; i < 14; i++) {
    g.fillStyle = (i % 2 === 0) ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)';
    g.fillRect(i * c.width / 14, 0, c.width / 14 + 1, c.height);
  }
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 3;
  function line(x1, z1, x2, z2) {
    g.beginPath();
    g.moveTo((x1 + HALF_L) * sx, (z1 + HALF_W) * sz);
    g.lineTo((x2 + HALF_L) * sx, (z2 + HALF_W) * sz);
    g.stroke();
  }
  function circle(x, z, r, a0, a1) {
    g.beginPath();
    g.arc((x + HALF_L) * sx, (z + HALF_W) * sz, r * sx, a0 || 0, a1 || Math.PI * 2);
    g.stroke();
  }
  g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
  line(0, -HALF_W, 0, HALF_W);
  circle(0, 0, 9.15);
  [-1, 1].forEach(function (s) {
    var gx = s * HALF_L;
    line(gx, -BOX_W, gx - s * BOX_D, -BOX_W);
    line(gx, BOX_W, gx - s * BOX_D, BOX_W);
    line(gx - s * BOX_D, -BOX_W, gx - s * BOX_D, BOX_W);
    line(gx, -9.16, gx - s * 5.5, -9.16);
    line(gx, 9.16, gx - s * 5.5, 9.16);
    line(gx - s * 5.5, -9.16, gx - s * 5.5, 9.16);
    var px = gx - s * 11;
    g.beginPath(); g.arc((px + HALF_L) * sx, HALF_W * sz, 3, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    var a = Math.acos(5.5 / 9.15);
    if (s === 1) circle(px, 0, 9.15, Math.PI - a, Math.PI + a);
    else circle(px, 0, 9.15, -a, a);
  });
  g.beginPath(); g.arc(c.width / 2, c.height / 2, 3, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
}
function buildPitchTexture() {
  var c = document.createElement('canvas');
  c.width = 1600; c.height = 1040;
  paintPitchCanvas(c, null);                     // draw immediately (flat green)
  var tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 16;
  // then repaint with the real CC0 grass photo once it decodes
  if (typeof GRASS_B64 === 'string') {
    var img = new Image();
    img.onload = function () {
      paintPitchCanvas(c, img);
      tex.needsUpdate = true;
    };
    img.src = GRASS_B64;
  }
  return tex;
}

var pitch = new THREE.Mesh(
  new THREE.PlaneGeometry(FIELD_L, FIELD_W),
  new THREE.MeshLambertMaterial({ map: buildPitchTexture() })
);
pitch.rotation.x = -Math.PI / 2;
pitch.receiveShadow = true;
scene.add(pitch);

var apron = new THREE.Mesh(
  new THREE.PlaneGeometry(FIELD_L + 26, FIELD_W + 26),
  new THREE.MeshLambertMaterial({ color: 0x255f28 })
);
apron.rotation.x = -Math.PI / 2;
apron.position.y = -0.02;
apron.receiveShadow = true;
scene.add(apron);

// ---------- Stadium ----------
function crowdTexture(w, h) {
  // rows of little supporters: head + shoulders, scarves, varied skin & shirt colors
  var c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  var g = c.getContext('2d');
  g.fillStyle = '#151d26';
  g.fillRect(0, 0, 512, 256);
  var shirts = ['#e53935', '#1e88e5', '#eceff1', '#fdd835', '#8d6e63', '#43a047', '#f48fb1', '#90a4ae', '#5e35b1', '#ef6c00'];
  var skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  for (var row = 0; row < 16; row++) {
    // seat row shadow
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, row * 16 + 12, 512, 4);
    for (var i = 0; i < 52; i++) {
      var x = i * 10 + ((row % 2) * 5) + rand(-1.5, 1.5);
      var y = row * 16 + rand(-1, 1);
      g.fillStyle = shirts[(Math.random() * shirts.length) | 0];
      g.fillRect(x - 3, y + 5, 7, 8);                 // torso
      g.fillStyle = skins[(Math.random() * skins.length) | 0];
      g.beginPath();
      g.arc(x, y + 3, 2.6, 0, Math.PI * 2);           // head
      g.fill();
      if (Math.random() < 0.08) {                     // the odd raised scarf
        g.fillStyle = '#e53935';
        g.fillRect(x - 4, y - 2, 9, 2);
      }
    }
  }
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(w / 26, h / 13);
  return t;
}
function addStand(len, x, z, rotY) {
  var h = 14, depth = 16;
  var mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(len, Math.sqrt(h * h + depth * depth)),
    new THREE.MeshLambertMaterial({ map: crowdTexture(len, 16) })
  );
  mesh.position.set(x, h / 2 + 0.5, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
  mesh.rotateX(-0.55);
  var roof = new THREE.Mesh(new THREE.BoxGeometry(len, 0.8, 4),
    new THREE.MeshLambertMaterial({ color: 0x37474f }));
  roof.position.set(x, h + 2.5, z);
  roof.rotation.y = rotY;
  scene.add(roof);
}
addStand(FIELD_L + 20, 0, HALF_W + 18, Math.PI);
addStand(FIELD_L + 20, 0, -HALF_W - 18, 0);
addStand(FIELD_W + 14, HALF_L + 18, 0, -Math.PI / 2);
addStand(FIELD_W + 14, -HALF_L - 18, 0, Math.PI / 2);
// sponsor boards (fictional brands) — a proper broadcast touch
function adBoardTexture() {
  var c = document.createElement('canvas');
  c.width = 1024; c.height = 48;
  var g = c.getContext('2d');
  var brands = ['MERIDIAN AIR', 'VOLT COLA', 'NORDPEAK', 'AURUM BANK', 'STRIDE 90', 'LUMA TEL'];
  var cols = ['#0d47a1', '#b71c1c', '#1b5e20', '#4a148c', '#e65100', '#006064'];
  for (var i = 0; i < 6; i++) {
    g.fillStyle = cols[i];
    g.fillRect(i * 171, 0, 171, 48);
    g.fillStyle = '#ffffff';
    g.font = 'bold 22px Arial';
    g.textAlign = 'center';
    g.fillText(brands[i], i * 171 + 85, 32);
  }
  var t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}
var adTex = adBoardTexture();
[-1, 1].forEach(function (s) {
  var board = new THREE.Mesh(new THREE.BoxGeometry(FIELD_L + 8, 1, 0.3),
    new THREE.MeshLambertMaterial({ map: adTex }));
  board.position.set(0, 0.5, s * (HALF_W + 4));
  scene.add(board);
});
// jumbotron screen above the far stand — live score & clock
var jumboCanvas = document.createElement('canvas');
jumboCanvas.width = 512; jumboCanvas.height = 160;
var jumboTex = new THREE.CanvasTexture(jumboCanvas);
(function () {
  var frame2 = new THREE.Mesh(new THREE.BoxGeometry(26, 8.6, 1),
    new THREE.MeshLambertMaterial({ color: 0x1a2330 }));
  frame2.position.set(0, 19, -HALF_W - 16);
  scene.add(frame2);
  var screen2 = new THREE.Mesh(new THREE.PlaneGeometry(24.4, 7.4),
    new THREE.MeshBasicMaterial({ map: jumboTex }));
  screen2.position.set(0, 19, -HALF_W - 15.4);
  scene.add(screen2);
})();
var jumboTimer = 0;
function updateJumbotron(dt) {
  jumboTimer -= dt;
  if (jumboTimer > 0) return;
  jumboTimer = 0.5;
  var g = jumboCanvas.getContext('2d');
  g.fillStyle = '#04070c';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#22314a';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 506, 154);
  if (teams.length) {
    g.textAlign = 'center';
    g.fillStyle = '#ffd54f';
    g.font = 'bold 34px Arial';
    g.fillText(displayClock(), 256, 44);
    g.fillStyle = '#ffffff';
    g.font = 'bold 52px Arial';
    g.fillText(home.short + '  ' + home.score + ' - ' + away.score + '  ' + away.short, 256, 110);
    g.fillStyle = '#5a7a9c';
    g.font = '20px Arial';
    g.fillText(trainingMode ? 'TRAINING SESSION' : fixtureTitle(match.fixture || { type: 'league' }).toUpperCase().slice(0, 42), 256, 144);
  }
  jumboTex.needsUpdate = true;
}

// floodlight towers (they glow when the match is at night)
var floodHeads = [];
[[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (q) {
  var px2 = q[0] * (HALF_L + 14), pz2 = q[1] * (HALF_W + 12);
  var pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 26, 8),
    new THREE.MeshLambertMaterial({ color: 0x546e7a }));
  pole2.position.set(px2, 13, pz2);
  scene.add(pole2);
  var head2 = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 0.8),
    new THREE.MeshBasicMaterial({ color: 0x37474f }));
  head2.position.set(px2, 27, pz2);
  head2.lookAt(0, 0, 0);
  scene.add(head2);
  floodHeads.push(head2);
});
// corner flags
[-1, 1].forEach(function (sx) {
  [-1, 1].forEach(function (sz) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6),
      new THREE.MeshLambertMaterial({ color: 0xffe082 }));
    pole.position.set(sx * HALF_L, 0.75, sz * HALF_W);
    scene.add(pole);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xe53935, side: THREE.DoubleSide }));
    flag.position.set(sx * HALF_L - sx * 0.24, 1.32, sz * HALF_W);
    scene.add(flag);
  });
});

// ---------- Goals ----------
var postMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
function netTexture() {
  var c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  var g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.5;
  for (var i2 = 0; i2 <= 128; i2 += 10) {
    g.beginPath(); g.moveTo(i2, 0); g.lineTo(i2, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i2); g.lineTo(128, i2); g.stroke();
  }
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
}
var netMat = new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });
function buildGoal(sideX) {
  var grp = new THREE.Group();
  [-GOAL_W / 2, GOAL_W / 2].forEach(function (z) {
    var post = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, GOAL_H, 10), postMat);
    post.position.set(0, GOAL_H / 2, z);
    grp.add(post);
  });
  var bar = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, GOAL_W, 10), postMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, GOAL_H, 0);
  grp.add(bar);
  var depth = 1.9;
  var back = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, GOAL_H), netMat);
  back.position.set(sideX > 0 ? depth : -depth, GOAL_H / 2, 0);
  back.rotation.y = Math.PI / 2;
  grp.add(back);
  var top = new THREE.Mesh(new THREE.PlaneGeometry(depth, GOAL_W), netMat);
  top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2;
  top.position.set(sideX > 0 ? depth / 2 : -depth / 2, GOAL_H, 0);
  grp.add(top);
  [-GOAL_W / 2, GOAL_W / 2].forEach(function (z) {
    var side = new THREE.Mesh(new THREE.PlaneGeometry(depth, GOAL_H), netMat);
    side.position.set(sideX > 0 ? depth / 2 : -depth / 2, GOAL_H / 2, z);
    grp.add(side);
  });
  grp.position.x = sideX;
  scene.add(grp);
}
buildGoal(HALF_L);
buildGoal(-HALF_L);

// ---------- Ball ----------
function ballTexture() {
  var c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  var g = c.getContext('2d');
  g.fillStyle = '#f5f5f5';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1a1a1a';
  for (var r = 0; r < 3; r++) {
    for (var i2 = 0; i2 < 6; i2++) {
      var px = i2 * 42 + (r % 2) * 21 + 10;
      var py = r * 42 + 22;
      g.beginPath();
      for (var k2 = 0; k2 < 5; k2++) {
        var a2 = -Math.PI / 2 + k2 * Math.PI * 2 / 5;
        var xx = px + Math.cos(a2) * 11, yy = py + Math.sin(a2) * 11;
        if (k2 === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.closePath();
      g.fill();
    }
  }
  var t = new THREE.CanvasTexture(c);
  return t;
}
var ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 24, 18),
  new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.3 })
);
ballMesh.castShadow = true;
scene.add(ballMesh);
var ball = {
  pos: new THREE.Vector3(0, BALL_R, 0),
  vel: new THREE.Vector3(),
  carrier: null,
  lastTouchTeam: null,
  kickCooldown: 0,
  lastKicker: null,
  restartProtect: 0,
  inPlayGrace: 0,         // suppress out-of-play calls just after restart kicks
  offside: null           // players flagged offside at the moment of the last kick
};

// ---------- Humanoid factory ----------
var SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4226, 0xa0673f];
var HAIR_COLORS = [0x1a1a1a, 0x2b2b2b, 0x3b2b20, 0x5a3825, 0x8b5a2b, 0xd8b26a];

function numberTexture(num, kitHex) {
  var c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  var g = c.getContext('2d');
  // match the shirt, pick a contrasting digit color
  g.fillStyle = '#' + kitHex.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 64, 64);
  var r2 = (kitHex >> 16) & 255, g2 = (kitHex >> 8) & 255, b2 = kitHex & 255;
  var lum = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
  g.fillStyle = lum > 140 ? '#111111' : '#ffffff';
  g.font = 'bold 44px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(num), 32, 34);
  return new THREE.CanvasTexture(c);
}
function makeHuman(kitMat, shortsMat, sockMat, shirtNum, kitHex, build) {
  build = build || {};
  var skinMat = new THREE.MeshLambertMaterial({ color: pick(SKIN_TONES) });
  var hairMat = new THREE.MeshLambertMaterial({ color: pick(HAIR_COLORS) });
  var bootMat = new THREE.MeshLambertMaterial({ color: pick([0x212121, 0xbf360c, 0x0d47a1, 0xf5f5f5]) });
  var darkMat = new THREE.MeshBasicMaterial({ color: 0x181210 });

  var g = new THREE.Group();
  var torsoGrp = new THREE.Group();
  g.add(torsoGrp);

  // pelvis + tapered chest for a real silhouette
  var pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.18, 10), shortsMat);
  pelvis.position.y = 0.98;
  torsoGrp.add(pelvis);
  var chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.34, 4, 10), kitMat);
  chest.position.y = 1.24;
  chest.scale.set(1.12, 1, 0.82);
  chest.castShadow = true;
  torsoGrp.add(chest);
  var collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 12), shortsMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.5;
  torsoGrp.add(collar);
  var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), skinMat);
  neck.position.y = 1.52;
  torsoGrp.add(neck);

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), skinMat);
  head.scale.set(0.92, 1.08, 0.98);
  head.position.y = 1.64;
  head.castShadow = true;
  torsoGrp.add(head);
  // eyes give faces life even at broadcast distance
  [-1, 1].forEach(function (sd) {
    var eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), darkMat);
    eye.position.set(sd * 0.042, 1.66, 0.1);
    torsoGrp.add(eye);
  });
  // hair styles: bald / short / curly / long
  var hs = Math.random();
  if (hs > 0.1) {
    var hair;
    if (hs < 0.65) {
      hair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), hairMat);
      hair.scale.set(0.95, 0.66, 1);
      hair.position.y = 1.7;
    } else if (hs < 0.85) {
      hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), hairMat);
      hair.scale.set(1, 0.92, 1);
      hair.position.y = 1.7;
    } else {
      hair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), hairMat);
      hair.scale.set(0.95, 0.72, 1.15);
      hair.position.y = 1.69;
      var tail = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), hairMat);
      tail.position.set(0, 1.6, -0.1);
      torsoGrp.add(tail);
    }
    torsoGrp.add(hair);
  }

  var shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.165, 0.24, 10), shortsMat);
  shorts.position.y = 0.86;
  torsoGrp.add(shorts);

  if (shirtNum !== undefined && kitHex !== undefined) {
    var numPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshLambertMaterial({ map: numberTexture(shirtNum, kitHex) })
    );
    numPlane.position.set(0, 1.24, -0.175);
    numPlane.rotation.y = Math.PI;
    torsoGrp.add(numPlane);
  }

  // two-segment limbs with elbow & knee joints
  function seg(r, len, mat) {
    var m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat);
    m.position.y = -(len / 2 + r);
    m.castShadow = true;
    return m;
  }
  function makeArm(sideX) {
    var shoulder = new THREE.Group();
    shoulder.position.set(sideX * 0.26, 1.44, 0);
    shoulder.add(seg(0.05, 0.2, skinMat));
    var sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.15, 8), kitMat);
    sleeve.position.y = -0.08;
    shoulder.add(sleeve);
    var elbow = new THREE.Group();
    elbow.position.y = -0.32;
    elbow.add(seg(0.044, 0.18, skinMat));
    var hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skinMat);
    hand.position.y = -0.3;
    elbow.add(hand);
    shoulder.add(elbow);
    return { root: shoulder, joint: elbow };
  }
  function makeLeg(sideX) {
    var hip = new THREE.Group();
    hip.position.set(sideX * 0.1, 0.92, 0);
    hip.add(seg(0.068, 0.26, skinMat));
    var knee = new THREE.Group();
    knee.position.y = -0.42;
    knee.add(seg(0.055, 0.2, skinMat));
    var sock = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.22, 8), sockMat);
    sock.position.y = -0.28;
    knee.add(sock);
    var boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.075, 0.23), bootMat);
    boot.position.set(0, -0.45, 0.05);
    boot.castShadow = true;
    knee.add(boot);
    hip.add(knee);
    return { root: hip, joint: knee };
  }
  var aL = makeArm(-1), aR = makeArm(1), lL = makeLeg(-1), lR = makeLeg(1);
  torsoGrp.add(aL.root); torsoGrp.add(aR.root);
  g.add(lL.root); g.add(lR.root);

  // body-shape individuality (height / bulk)
  g.scale.set(build.w || 1, build.h || 1, build.w || 1);

  return {
    group: g, torsoGrp: torsoGrp,
    armL: aL.root, armR: aR.root, elbowL: aL.joint, elbowR: aR.joint,
    legL: lL.root, legR: lR.root, kneeL: lL.joint, kneeR: lR.joint
  };
}

function animateHuman(h, speed, phase, throwPose) {
  var amp = clamp(speed * 0.13, 0.05, 0.85);
  var s = Math.sin(phase);
  var c2 = Math.cos(phase);
  h.legL.rotation.x = s * amp;
  h.legR.rotation.x = -s * amp;
  // knees flex on the back-swing, extend into ground contact
  if (h.kneeL) {
    h.kneeL.rotation.x = clamp(Math.max(0, -s) * amp * 1.6 + amp * 0.25, 0, 2);
    h.kneeR.rotation.x = clamp(Math.max(0, s) * amp * 1.6 + amp * 0.25, 0, 2);
  }
  if (throwPose) {
    h.armL.rotation.x = -2.7;
    h.armR.rotation.x = -2.7;
    if (h.elbowL) { h.elbowL.rotation.x = -0.5; h.elbowR.rotation.x = -0.5; }
  } else {
    h.armL.rotation.x = -s * amp * 0.85;
    h.armR.rotation.x = s * amp * 0.85;
    // elbows pump near 90 degrees when running, hang loose when idle
    if (h.elbowL) {
      var bend = -0.35 - amp * 0.85;
      h.elbowL.rotation.x = bend;
      h.elbowR.rotation.x = bend;
    }
  }
  h.torsoGrp.rotation.x = clamp(speed * 0.028, 0, 0.22);
  h.torsoGrp.rotation.y = c2 * amp * 0.07;      // subtle counter-rotation
}

// ---------- Clubs & world ----------
var HARDY_DEF = { name: 'Hardy FC', short: 'HFC', color: 0xe53935, shorts: 0xffffff, sock: 0xe53935, keeper: 0xff9800, strength: 74, formation: '4-3-3' };

var D1_CLUBS = [
  { name: 'Vulcan City',       short: 'VUL', color: 0x37474f, shorts: 0xb0bec5, sock: 0x37474f, keeper: 0xff5252, strength: 80, formation: '4-3-3' },
  { name: 'Port Meridian FC',  short: 'POR', color: 0x00897b, shorts: 0xffffff, sock: 0x00897b, keeper: 0xff7043, strength: 77, formation: '4-2-3-1' },
  { name: 'Atlas United',      short: 'ATL', color: 0x1e88e5, shorts: 0x0d2b45, sock: 0x1e88e5, keeper: 0xfdd835, strength: 75, formation: '4-4-2' },
  { name: 'Kestrel Bay',       short: 'KES', color: 0x00acc1, shorts: 0x004d40, sock: 0x00acc1, keeper: 0xff8a65, strength: 74, formation: '4-3-3' },
  { name: 'Northgate Athletic',short: 'NOR', color: 0x2e7d32, shorts: 0xffffff, sock: 0x2e7d32, keeper: 0xffca28, strength: 73, formation: '5-3-2' },
  { name: 'Ravenshold Rovers', short: 'RAV', color: 0x6a1b9a, shorts: 0x212121, sock: 0x6a1b9a, keeper: 0x76ff03, strength: 72, formation: '4-3-3' },
  { name: 'Argent Rovers',     short: 'ARG', color: 0x90a4ae, shorts: 0x263238, sock: 0x90a4ae, keeper: 0x7c4dff, strength: 71, formation: '4-2-3-1' },
  { name: 'Solaris SC',        short: 'SOL', color: 0xef6c00, shorts: 0x212121, sock: 0xef6c00, keeper: 0x29b6f6, strength: 70, formation: '4-4-2' },
  { name: 'Ember Vale United', short: 'EMB', color: 0xf9a825, shorts: 0x4e342e, sock: 0xf9a825, keeper: 0x7e57c2, strength: 68, formation: '3-5-2' },
  { name: 'Corsair Athletic',  short: 'COR', color: 0x283593, shorts: 0xffffff, sock: 0x283593, keeper: 0xffab00, strength: 76, formation: '4-3-3' },
  { name: 'Thornmere FC',      short: 'THO', color: 0x004d40, shorts: 0xb2dfdb, sock: 0x004d40, keeper: 0xff6f00, strength: 69, formation: '4-4-2' },
  { name: 'Highspire United',  short: 'HIG', color: 0xad1457, shorts: 0xffffff, sock: 0xad1457, keeper: 0x00e5ff, strength: 67, formation: '4-2-3-1' },
  { name: 'Meadowvale',        short: 'MEA', color: 0x7cb342, shorts: 0x33691e, sock: 0x7cb342, keeper: 0xe040fb, strength: 66, formation: '4-4-2' },
  { name: 'Saltmarsh Town',    short: 'SAL', color: 0x455a64, shorts: 0xcfd8dc, sock: 0x455a64, keeper: 0xffff00, strength: 65, formation: '5-3-2' },
  { name: 'Beacon Rock',       short: 'BEA', color: 0xf4511e, shorts: 0xffffff, sock: 0xf4511e, keeper: 0x76ff03, strength: 64, formation: '3-5-2' }
];
var D2_CLUBS = [
  { name: 'Ironhaven FC',      short: 'IRO', color: 0x795548, shorts: 0x3e2723, sock: 0x795548, keeper: 0x4dd0e1, strength: 69, formation: '4-4-2' },
  { name: 'Stormport SC',      short: 'STO', color: 0x0277bd, shorts: 0xffffff, sock: 0x0277bd, keeper: 0xffd740, strength: 68, formation: '4-3-3' },
  { name: 'Duskford Town',     short: 'DUS', color: 0x5e35b1, shorts: 0x1a1a2e, sock: 0x5e35b1, keeper: 0x69f0ae, strength: 66, formation: '4-2-3-1' },
  { name: 'Whitecliff Albion', short: 'WHI', color: 0xeceff1, shorts: 0x37474f, sock: 0xeceff1, keeper: 0xff6e40, strength: 65, formation: '4-4-2' },
  { name: 'Fenwick Rangers',   short: 'FEN', color: 0x558b2f, shorts: 0xffffff, sock: 0x558b2f, keeper: 0xffab40, strength: 64, formation: '5-3-2' },
  { name: 'Goldcrest City',    short: 'GOL', color: 0xc0a145, shorts: 0x212121, sock: 0xc0a145, keeper: 0x40c4ff, strength: 63, formation: '4-3-3' },
  { name: 'Marrowgate United', short: 'MAR', color: 0x33691e, shorts: 0xdcedc8, sock: 0x33691e, keeper: 0xff5252, strength: 62, formation: '3-5-2' },
  { name: 'Cinder Hill',       short: 'CIN', color: 0xd84315, shorts: 0x263238, sock: 0xd84315, keeper: 0xeeff41, strength: 61, formation: '4-4-2' },
  { name: 'Bramblewood FC',    short: 'BRA', color: 0x6d4c41, shorts: 0xefebe9, sock: 0x6d4c41, keeper: 0x18ffff, strength: 60, formation: '4-2-3-1' },
  { name: 'Osprey Point',      short: 'OSP', color: 0x00695c, shorts: 0xffffff, sock: 0x00695c, keeper: 0xffd54f, strength: 59, formation: '4-4-2' },
  { name: 'Foxglove FC',       short: 'FOX', color: 0x8e24aa, shorts: 0xf3e5f5, sock: 0x8e24aa, keeper: 0xc6ff00, strength: 58, formation: '4-4-2' },
  { name: 'Wrenfield',         short: 'WRE', color: 0x827717, shorts: 0xffffff, sock: 0x827717, keeper: 0x40c4ff, strength: 57, formation: '4-3-3' },
  { name: 'Coppergate SC',     short: 'COP', color: 0xbf360c, shorts: 0xffccbc, sock: 0xbf360c, keeper: 0x00e676, strength: 56, formation: '4-2-3-1' },
  { name: 'Mistral Rovers',    short: 'MIS', color: 0x0091ea, shorts: 0x01579b, sock: 0x0091ea, keeper: 0xffd180, strength: 55, formation: '4-4-2' },
  { name: 'Oakhenge Town',     short: 'OAK', color: 0x4e342e, shorts: 0xd7ccc8, sock: 0x4e342e, keeper: 0x64ffda, strength: 54, formation: '5-3-2' },
  { name: 'Pellmarsh United',  short: 'PEL', color: 0x37652c, shorts: 0xffffff, sock: 0x37652c, keeper: 0xff9e80, strength: 53, formation: '4-4-2' }
];
var DOMESTIC = {};
[HARDY_DEF].concat(D1_CLUBS).concat(D2_CLUBS).forEach(function (c) { DOMESTIC[c.name] = c; });

// foreign leagues are fully simulated — results roll in every matchday
var FOREIGN_LEAGUES = [
  { key: 'azure', name: 'Ligue Azure (Azuria)', clubs: [
    { name: 'AS Lumière', str: 82 }, { name: 'Royal Côtière', str: 78 }, { name: 'Azur Métropole', str: 76 },
    { name: 'Olympique Verdant', str: 74 }, { name: 'Étoile du Nord', str: 72 }, { name: 'FC Miroir', str: 70 },
    { name: 'Racing Falaise', str: 68 }, { name: 'Union Sel', str: 66 }, { name: 'Sporting Rivage', str: 64 }, { name: 'Perle Noire', str: 62 },
    { name: 'Violette FC', str: 63 }, { name: 'Cap Doré', str: 61 }, { name: 'Brumaire SC', str: 60 },
    { name: 'Roc Blanc', str: 59 }, { name: 'Fleuve Argent', str: 58 }, { name: 'Montclair FC', str: 57 }
  ]},
  { key: 'dorada', name: 'Liga Dorada (Valdorra)', clubs: [
    { name: 'Real Sombra', str: 83 }, { name: 'Atlético Faro', str: 79 }, { name: 'Deportivo Cumbre', str: 75 },
    { name: 'Rayo Esmeralda', str: 73 }, { name: 'CF Sol Poniente', str: 71 }, { name: 'Club Sierra', str: 69 },
    { name: 'Toro Rojo', str: 67 }, { name: 'Marea Alta', str: 65 }, { name: 'Valle Central', str: 63 }, { name: 'Puerto Bravo', str: 61 },
    { name: 'Estrella Baja', str: 62 }, { name: 'Corona Verde', str: 60 }, { name: 'Río Bravo', str: 59 },
    { name: 'Puente Alto', str: 58 }, { name: 'Lobo Gris', str: 57 }, { name: 'Costa Serena', str: 56 }
  ]},
  { key: 'norland', name: 'Nordic Premier (Norland)', clubs: [
    { name: 'Fjordvik IF', str: 80 }, { name: 'Bjørnstad BK', str: 76 }, { name: 'Isbre United', str: 74 },
    { name: 'Nordlys FC', str: 72 }, { name: 'Vintersund', str: 70 }, { name: 'Havørn SK', str: 68 },
    { name: 'Steinby IL', str: 66 }, { name: 'Elvedal', str: 64 }, { name: 'Polarhavn', str: 62 }, { name: 'Aurora Kysten', str: 60 },
    { name: 'Ulvfjell', str: 61 }, { name: 'Snøhavn', str: 59 }, { name: 'Granlund IF', str: 58 },
    { name: 'Kystvakt BK', str: 57 }, { name: 'Myrdal IL', str: 56 }, { name: 'Solvind', str: 55 }
  ]}
];
// playable kits for foreign clubs (needed when they visit in the Champions Cup)
var FPALETTE = [0xe57373, 0x64b5f6, 0x81c784, 0xffb74d, 0xba68c8, 0x4db6ac, 0xf06292, 0xa1887f,
  0x90a4ae, 0xfff176, 0x7986cb, 0xaed581, 0xff8a65, 0x4fc3f7, 0xdce775, 0xb39ddb];
var FOREIGN_DEFS = {};
FOREIGN_LEAGUES.forEach(function (L) {
  L.clubs.forEach(function (c, i) {
    FOREIGN_DEFS[c.name] = {
      name: c.name,
      short: c.name.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3).toUpperCase(),
      color: FPALETTE[i % FPALETTE.length],
      shorts: i % 2 === 0 ? 0x212121 : 0xffffff,
      sock: FPALETTE[i % FPALETTE.length],
      keeper: FPALETTE[(i + 8) % FPALETTE.length],
      strength: c.str,
      formation: ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'][i % 5]
    };
  });
});
// national teams (World Cup every 4th season — you coach Meridia)
var MERIDIA_DEF = { name: 'Meridia', short: 'MER', color: 0xc62828, shorts: 0xffffff, sock: 0xc62828, keeper: 0x00bcd4, strength: 78, formation: '4-3-3' };
var NATIONS = [
  MERIDIA_DEF,
  { name: 'Azuria',   short: 'AZU', color: 0x1565c0, shorts: 0xffffff, sock: 0x1565c0, keeper: 0xffd740, strength: 79, formation: '4-2-3-1' },
  { name: 'Valdorra', short: 'VAL', color: 0xf9a825, shorts: 0xc62828, sock: 0xf9a825, keeper: 0x00e676, strength: 80, formation: '4-3-3' },
  { name: 'Norland',  short: 'NOR', color: 0x37474f, shorts: 0xeceff1, sock: 0x37474f, keeper: 0xff8a65, strength: 77, formation: '4-4-2' },
  { name: 'Kestara',  short: 'KET', color: 0x2e7d32, shorts: 0xffffff, sock: 0x2e7d32, keeper: 0xba68c8, strength: 76, formation: '4-4-2' },
  { name: 'Solheim',  short: 'SOL', color: 0xff7043, shorts: 0x263238, sock: 0xff7043, keeper: 0x4fc3f7, strength: 75, formation: '3-5-2' },
  { name: 'Vantara',  short: 'VAN', color: 0x7b1fa2, shorts: 0xffffff, sock: 0x7b1fa2, keeper: 0xdce775, strength: 74, formation: '4-2-3-1' },
  { name: 'Ostrelia', short: 'OST', color: 0x00897b, shorts: 0xfff9c4, sock: 0x00897b, keeper: 0xff5252, strength: 73, formation: '5-3-2' }
];
var NAT_DEFS = {};
NATIONS.forEach(function (n) { NAT_DEFS[n.name] = n; });
function clubDefByName(name) { return DOMESTIC[name] || FOREIGN_DEFS[name] || NAT_DEFS[name] || HARDY_DEF; }

var CUP_NAME = 'CHAMPIONS CUP';
var CUP_ROUND_NAMES = ['Round of 16', 'Quarter-final', 'Semi-final', 'FINAL'];
var CUP_PRIZES = [2, 3.5, 5, 12];   // prize for WINNING each round; losing the final still pays 6

function shuffled(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = (Math.random() * (i + 1)) | 0;
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ---------- Formations ----------
var FORMATIONS = {
  '4-3-3': [
    { x: -0.93, z: 0.0, role: 'GK' },
    { x: -0.62, z: -0.62, role: 'DF' }, { x: -0.68, z: -0.22, role: 'DF' },
    { x: -0.68, z: 0.22, role: 'DF' }, { x: -0.62, z: 0.62, role: 'DF' },
    { x: -0.28, z: -0.36, role: 'MF' }, { x: -0.34, z: 0.0, role: 'MF' }, { x: -0.28, z: 0.36, role: 'MF' },
    { x: 0.18, z: -0.62, role: 'FW' }, { x: 0.24, z: 0.0, role: 'FW' }, { x: 0.18, z: 0.62, role: 'FW' }
  ],
  '4-4-2': [
    { x: -0.93, z: 0.0, role: 'GK' },
    { x: -0.62, z: -0.62, role: 'DF' }, { x: -0.68, z: -0.22, role: 'DF' },
    { x: -0.68, z: 0.22, role: 'DF' }, { x: -0.62, z: 0.62, role: 'DF' },
    { x: -0.22, z: -0.62, role: 'MF' }, { x: -0.3, z: -0.2, role: 'MF' },
    { x: -0.3, z: 0.2, role: 'MF' }, { x: -0.22, z: 0.62, role: 'MF' },
    { x: 0.22, z: -0.18, role: 'FW' }, { x: 0.22, z: 0.18, role: 'FW' }
  ],
  '4-2-3-1': [
    { x: -0.93, z: 0.0, role: 'GK' },
    { x: -0.62, z: -0.62, role: 'DF' }, { x: -0.68, z: -0.22, role: 'DF' },
    { x: -0.68, z: 0.22, role: 'DF' }, { x: -0.62, z: 0.62, role: 'DF' },
    { x: -0.4, z: -0.2, role: 'MF' }, { x: -0.4, z: 0.2, role: 'MF' },
    { x: -0.1, z: -0.5, role: 'MF' }, { x: -0.08, z: 0.0, role: 'MF' }, { x: -0.1, z: 0.5, role: 'MF' },
    { x: 0.26, z: 0.0, role: 'FW' }
  ],
  '3-5-2': [
    { x: -0.93, z: 0.0, role: 'GK' },
    { x: -0.66, z: -0.35, role: 'DF' }, { x: -0.7, z: 0.0, role: 'DF' }, { x: -0.66, z: 0.35, role: 'DF' },
    { x: -0.28, z: -0.68, role: 'MF' }, { x: -0.32, z: -0.26, role: 'MF' }, { x: -0.38, z: 0.0, role: 'MF' },
    { x: -0.32, z: 0.26, role: 'MF' }, { x: -0.28, z: 0.68, role: 'MF' },
    { x: 0.22, z: -0.18, role: 'FW' }, { x: 0.22, z: 0.18, role: 'FW' }
  ],
  '5-3-2': [
    { x: -0.93, z: 0.0, role: 'GK' },
    { x: -0.56, z: -0.7, role: 'DF' }, { x: -0.66, z: -0.32, role: 'DF' }, { x: -0.7, z: 0.0, role: 'DF' },
    { x: -0.66, z: 0.32, role: 'DF' }, { x: -0.56, z: 0.7, role: 'DF' },
    { x: -0.26, z: -0.35, role: 'MF' }, { x: -0.32, z: 0.0, role: 'MF' }, { x: -0.26, z: 0.35, role: 'MF' },
    { x: 0.22, z: -0.18, role: 'FW' }, { x: 0.22, z: 0.18, role: 'FW' }
  ]
};
var MENTALITIES = ['defensive', 'balanced', 'attacking'];

// ---------- Player generation ----------
var SURNAMES = ['Okafor', 'Reyes', 'Lindqvist', 'Baptiste', 'Kovac', 'Moreau', 'Tanaka', 'Silva', 'Vance', 'Adeyemi',
  'Castellanos', 'Petrov', 'Duarte', 'Ngata', 'Halvorsen', 'Iqbal', 'Romano', 'Sato', 'Beaumont', 'Kimura',
  'Zubair', 'Fontaine', 'Mbeki', 'Torvald', 'Quintero', 'Ashworth', 'Delgado', 'Virtanen', 'Osei', 'Marchetti',
  'Novak', 'Traore', 'Eriksen', 'Vidal', 'Nakamura', 'Weiss', 'Camara', 'Bergstrom', 'Alvarez', 'Kone',
  'Farrell', 'Dubois', 'Mensah', 'Larsen', 'Herrera', 'Takeda', 'Bakker', 'Ivanov', 'Diallo', 'Marino',
  'Whitfield', 'Sorensen', 'Gutierrez', 'Abara', 'Lombardi', 'Youssef', 'Nyberg', 'Calderon', 'Ekwueme', 'Rousseau'];

// PlayStyles: trait badges with real mechanical effects
var TRAITS_BY_ROLE = {
  GK: ['Cat Reflexes', 'Sweeper Keeper', 'Footwork', 'Long Ball'],
  DF: ['Interceptor', 'Anchor', 'Slide Master', 'Aerial', 'Bruiser', 'Second Wind', 'Long Ball'],
  MF: ['Tiki-Taka', 'Long Ball', 'Technical', 'Rapid', 'Interceptor', 'Second Wind', 'Set-Piece Spec', 'Finesse'],
  FW: ['Power Shot', 'Finesse', 'Chip Master', 'Low Driven', 'Rapid', 'Technical', 'Aerial', 'Bruiser']
};
function rollTraits(role) {
  var pool = shuffled(TRAITS_BY_ROLE[role] || TRAITS_BY_ROLE.MF);
  return Math.random() < 0.3 ? [pool[0], pool[1]] : [pool[0]];
}
function hasTrait(p, t) {
  var d = p && (p.data || p);
  return !!(d && d.traits && d.traits.indexOf(t) >= 0);
}
var STYLES_BY_ROLE = {
  GK: ['Keeper'],
  DF: ['Balanced', 'Ball-Winner', 'Wide Runner', 'Balanced'],
  MF: ['Balanced', 'Playmaker', 'Ball-Winner', 'Winger'],
  FW: ['Balanced', 'Poacher', 'Target Man', 'Winger']
};

function playerValue(ovr) {
  return Math.max(0.4, Math.round((0.4 + Math.pow(Math.max(0, ovr - 58) / 10, 2.1) * 2) * 10) / 10);
}

function genId() { return 'p' + Math.floor(Math.random() * 1e9).toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
function genPlayer(role, base, usedNames) {
  function attr(mod) { return clamp(Math.round(base + mod + rand(-6, 6)), 40, 96); }
  var style = pick(STYLES_BY_ROLE[role]);
  var name = pick(SURNAMES), tries = 0;
  while (usedNames && usedNames[name] && tries < 50) { name = pick(SURNAMES); tries++; }
  if (usedNames) usedNames[name] = 1;
  var mods = {
    GK: { pace: -10, shoot: -25, pass: -8, def: 6, phys: 2 },
    DF: { pace: -2, shoot: -12, pass: -3, def: 8, phys: 4 },
    MF: { pace: 0, shoot: -2, pass: 7, def: -2, phys: 0 },
    FW: { pace: 4, shoot: 8, pass: -2, def: -16, phys: 0 }
  }[role];
  var p = {
    id: genId(),
    name: name,
    role: role,
    style: style,
    pace: attr(mods.pace),
    shoot: attr(mods.shoot),
    pass: attr(mods.pass),
    def: attr(mods.def),
    phys: attr(mods.phys),
    contract: irand(1, 3)
  };
  if (style === 'Winger') { p.pace = clamp(p.pace + 5, 40, 97); }
  if (style === 'Playmaker') { p.pass = clamp(p.pass + 6, 40, 97); p.pace = clamp(p.pace - 2, 40, 97); }
  if (style === 'Poacher') { p.shoot = clamp(p.shoot + 6, 40, 97); }
  if (style === 'Target Man') { p.phys = clamp(p.phys + 7, 40, 97); p.pace = clamp(p.pace - 3, 40, 97); }
  if (style === 'Ball-Winner') { p.def = clamp(p.def + 6, 40, 97); }
  p.ovr = calcOvr(p);
  p.traits = rollTraits(role);
  p.age = irand(17, 33);
  // young players have headroom to grow; older players are what they are
  var headroom = Math.max(0, 27 - p.age) * 1.3 + irand(0, 6);
  p.pot = Math.min(97, p.ovr + Math.round(headroom * rand(0.4, 1)));
  p.value = playerValue(p.ovr);
  return p;
}
function calcOvr(p) {
  var w = {
    GK: { pace: 0.05, shoot: 0.0, pass: 0.1, def: 0.65, phys: 0.2 },
    DF: { pace: 0.15, shoot: 0.05, pass: 0.15, def: 0.45, phys: 0.2 },
    MF: { pace: 0.15, shoot: 0.15, pass: 0.4, def: 0.15, phys: 0.15 },
    FW: { pace: 0.25, shoot: 0.45, pass: 0.15, def: 0.02, phys: 0.13 }
  }[p.role];
  return Math.round(p.pace * w.pace + p.shoot * w.shoot + p.pass * w.pass + p.def * w.def + p.phys * w.phys);
}

function genClubSquad(strength, usedNames) {
  var squad = [];
  usedNames = usedNames || {};
  ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW'].forEach(function (r) {
    squad.push(genPlayer(r, strength, usedNames));
  });
  return squad;
}
function usedNamesFromSquad() {
  var used = {};
  save.squad.forEach(function (p) { used[p.name] = 1; });
  return used;
}

function assignNumbers(squad) {
  var used = {};
  squad.forEach(function (p) { if (p.num) used[p.num] = 1; });
  squad.forEach(function (p) {
    if (!p.num) {
      var n = p.role === 'GK' ? 1 : irand(2, 39);
      while (used[n]) n++;
      used[n] = 1;
      p.num = n;
    }
  });
}

// ---------- Career save ----------
var SAVE_KEY = 'hardy_career_v7';
var storageOK = (function () {
  try { localStorage.setItem('__hardy_test', '1'); localStorage.removeItem('__hardy_test'); return true; }
  catch (e) { return false; }
})();
function tableFor(names) {
  var t = {};
  names.forEach(function (n) { t[n] = { P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, form: [] }; });
  return t;
}
function buildSchedule(divisionClubs) {
  // 16-club division: play every other club once → 15 matchdays
  var opps = divisionClubs.filter(function (n) { return n !== HARDY_DEF.name; });
  return shuffled(opps);
}
function startSeasonState(s) {
  s.tables = {
    d1: tableFor(s.divisions.d1),
    d2: tableFor(s.divisions.d2)
  };
  FOREIGN_LEAGUES.forEach(function (L) {
    s.tables[L.key] = tableFor(L.clubs.map(function (c) { return c.name; }));
  });
  var ownDiv = s.division === 1 ? s.divisions.d1 : s.divisions.d2;
  s.schedule = buildSchedule(ownDiv);
  s.cup = null;              // the Champions Cup begins after the league season ends
  s.cupPending = null;
  s.cwc = null;              // then the Club World Cup (league champions only)
  s.cwcPending = null;
  s.wc = null;               // then, every 4th season, the World Cup
  s.wcPending = null;
  s.md = 0;
}
function freshSave() {
  var squad = genClubSquad(HARDY_DEF.strength + 1);
  assignNumbers(squad);
  var s = {
    season: 1,
    division: 1,
    divisions: {
      d1: [HARDY_DEF.name].concat(D1_CLUBS.map(function (c) { return c.name; })),
      d2: D2_CLUBS.map(function (c) { return c.name; })
    },
    budget: 300,               // 🎁 Newbie Pack — every new manager starts loaded
    packShown: false,
    trophies: [],
    squad: squad,
    formation: '4-3-3',
    mentality: 'balanced',
    market: [],
    marketMd: -1,
    scoutLvl: 1,
    academyLvl: 1
  };
  startSeasonState(s);
  return s;
}
function loadSave() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      if (s && s.squad && s.tables && s.divisions && s.schedule && FORMATIONS[s.formation]) return s;
    }
  } catch (e) {}
  return freshSave();
}
var save = loadSave();
var SEASON_MDS = 15;
// backfill ids on older saves so the lineup picker can reference players
save.squad.forEach(function (p) { if (!p.id) p.id = genId(); });
(save.market || []).forEach(function (m) { if (m.p && !m.p.id) m.p.id = genId(); });
save.squad.forEach(function (p) { if (!p.traits) p.traits = rollTraits(p.role); });
(save.market || []).forEach(function (m) { if (m.p && !m.p.traits) m.p.traits = rollTraits(m.p.role); });
if (save.difficulty === undefined) save.difficulty = 3;
var DIFF_NAMES = ['Beginner', 'Amateur', 'Semi-Pro', 'Professional', 'World Class', 'Legendary'];
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
function ownDivisionKey() { return save.division === 1 ? 'd1' : 'd2'; }
function ownDivisionName() { return save.division === 1 ? 'Meridian League' : 'Meridian League 2'; }

function refreshMarket() {
  if (save.marketMd === save.md && save.market.length) return;
  save.marketMd = save.md;
  save.market = [];
  var used = usedNamesFromSquad();
  var sellerPool = D1_CLUBS.concat(D2_CLUBS).map(function (c) { return c.name; });
  var lvl = save.scoutLvl || 1;
  var count = 6 + lvl;                              // better scouts find more players
  for (var i = 0; i < count; i++) {
    var role = pick(['GK', 'DF', 'DF', 'MF', 'MF', 'FW', 'FW']);
    var p = genPlayer(role, irand(60 + lvl * 2, Math.min(90, 72 + lvl * 3)), used);
    p.age = irand(18, 31);
    var headroom = Math.max(0, 27 - p.age) * 1.3 + irand(0, 4 + lvl);
    p.pot = Math.min(97, p.ovr + Math.round(headroom * rand(0.4, 1)));
    save.market.push({ p: p, price: Math.round(p.value * 1.15 * 10) / 10, from: pick(sellerPool) });
  }
  persist();
}

// ---------- Teams ----------
function Player(team, slot, data) {
  this.team = team;
  this.slot = slot;
  this.role = slot.role;
  this.data = data;
  this.name = data.name;
  this.num = data.num || 0;
  this.style = data.style;
  this.pos = new THREE.Vector3();
  this.vel = new THREE.Vector3();
  this.facing = new THREE.Vector3(team.attackDir, 0, 0);
  this.stamina = 100;
  this.pressJob = false;
  this.yellows = 0;
  this.sentOff = false;
  this.throwIn = false;
  this.throwTimer = 0;
  this.holdBall = 0;
  this.setPiece = null;
  this.trickCd = 0;
  this.trickAnim = 0;
  this.slideTimer = 0;
  this.slideHit = false;
  this.matchRating = 6.0;
  this.runPhase = rand(0, 6);

  // ratings → physics. Wide ranges so differences are OBVIOUS on the pitch:
  // pace 10 ≈ a slow walk-jog, pace 95 ≈ elite sprinter.
  this.maxSpeed = (data.role === 'GK' ? 3.0 : 3.2) + (clamp(data.pace, 1, 99) / 100) * 5.2;
  this.accel = 6 + clamp(data.pace, 1, 99) * 0.10;
  this.skill = clamp(0.25 + data.ovr / 130, 0.25, 1.0);
  this.passSkill = clamp(0.25 + data.pass / 130, 0.25, 1.0);
  this.shootSkill = clamp(0.25 + data.shoot / 130, 0.25, 1.0);
  this.defSkill = data.def;
  this.drain = 7 * clamp(1.35 - data.phys / 250, 0.6, 1.4);
  if (hasTrait(data, 'Rapid')) this.maxSpeed *= 1.06;
  if (hasTrait(data, 'Second Wind')) this.drain *= 0.6;
  if (hasTrait(data, 'Footwork')) this.passSkill = clamp(this.passSkill + 0.15, 0, 1);
  // difficulty makes AI opponents SMARTER (decisions/technique), never faster
  if (!team.isUser) {
    var dd = ((save && save.difficulty !== undefined) ? save.difficulty : 3) - 3;
    this.skill = clamp(this.skill + dd * 0.05, 0.2, 1.0);
    this.passSkill = clamp(this.passSkill + dd * 0.05, 0.2, 1.0);
    this.shootSkill = clamp(this.shootSkill + dd * 0.05, 0.2, 1.0);
    this.thinkMul = clamp(1 - dd * 0.15, 0.55, 1.6);
  } else {
    this.thinkMul = 1;
  }

  var kit = this.role === 'GK' ? team.keeperMat : team.kitMat;
  var kitHex = this.role === 'GK' ? team.def.keeper : team.def.color;
  // physique from ratings: strong players are bigger, quick ones are slighter
  var buildSpec = {
    h: clamp(0.93 + (data.phys || 70) / 900 + rand(-0.02, 0.03), 0.9, 1.08),
    w: clamp(0.92 + (data.phys || 70) / 700 - (data.pace || 70) / 1400, 0.85, 1.12)
  };
  this.human = makeHuman(kit, team.shortsMat, team.sockMat, this.num || data.num || 0, kitHex, buildSpec);
  this.mesh = this.human.group;
  scene.add(this.mesh);
}

function kitTexture(c1, c2, pattern) {
  var c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  var g = c.getContext('2d');
  function css(h) { return '#' + h.toString(16).padStart(6, '0'); }
  g.fillStyle = css(c1);
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = css(c2);
  if (pattern === 'stripes') {
    for (var i = 0; i < 4; i++) g.fillRect(i * 32, 0, 14, 128);
  } else if (pattern === 'hoops') {
    for (var j = 0; j < 4; j++) g.fillRect(0, j * 32, 128, 12);
  } else if (pattern === 'sash') {
    g.save();
    g.translate(64, 64);
    g.rotate(-0.6);
    g.fillRect(-90, -12, 180, 24);
    g.restore();
  }
  var t = new THREE.CanvasTexture(c);
  return t;
}
function nameHash(n) {
  var h = 0;
  for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function Team(def, attackDir, isUser) {
  this.def = def;
  this.name = def.name;
  this.short = def.short;
  this.attackDir = attackDir;
  this.isUser = isUser;
  this.mentality = 'balanced';
  var pattern = def.pattern || ['solid', 'stripes', 'hoops', 'sash'][nameHash(def.name) % 4];
  var c2 = (def.shorts === def.color) ? 0xffffff : def.shorts;
  this.kitMat = pattern === 'solid' ?
    new THREE.MeshLambertMaterial({ color: def.color }) :
    new THREE.MeshLambertMaterial({ map: kitTexture(def.color, c2, pattern) });
  this.shortsMat = new THREE.MeshLambertMaterial({ color: def.shorts });
  this.sockMat = new THREE.MeshLambertMaterial({ color: def.sock });
  this.keeperMat = new THREE.MeshLambertMaterial({ color: def.keeper });
  this.players = [];
  this.score = 0;
}
Team.prototype.keeper = function () {
  for (var i = 0; i < this.players.length; i++) if (this.players[i].role === 'GK') return this.players[i];
  return this.players[0];
};
Team.prototype.destroy = function () {
  this.players.forEach(function (p) { scene.remove(p.mesh); });
  this.players = [];
};
Team.prototype.build = function (squadData, formationName) {
  var slots = FORMATIONS[formationName] || FORMATIONS['4-3-3'];
  var xi = this.isUser ? pickUserXI(squadData, slots) : pickXI(squadData, slots);
  for (var i = 0; i < slots.length; i++) {
    this.players.push(new Player(this, slots[i], xi[i]));
  }
};
Team.prototype.formationPoint = function (player, ballPos) {
  var s = player.slot;
  var x = s.x * HALF_L * 0.92 * this.attackDir;
  var z = s.z * HALF_W * 0.82;
  // play-style positioning
  if (player.style === 'Winger') z *= 1.18;
  if (player.style === 'Target Man') z *= 0.55;
  if (player.style === 'Playmaker') x -= this.attackDir * 4.5;
  if (player.style === 'Poacher' && ball.carrier && ball.carrier.team === this) {
    x += this.attackDir * 4; z *= 0.6;
  }
  // mentality
  if (player.role !== 'GK') {
    if (this.mentality === 'attacking') x += this.attackDir * 5;
    if (this.mentality === 'defensive') x -= this.attackDir * 5;
  }
  x += clamp(ballPos.x * 0.32, -14, 14);
  z += ballPos.z * 0.28;
  if (player.role === 'GK') { x = -this.attackDir * (HALF_L - 1.2); z = clamp(ballPos.z * 0.12, -3, 3); }
  return new THREE.Vector3(clamp(x, -HALF_L + 0.8, HALF_L - 0.8), 0, clamp(z, -HALF_W + 0.8, HALF_W - 0.8));
};

function pickXI(squadData, slots) {
  var pool = squadData.slice().sort(function (a, b) { return b.ovr - a.ovr; });
  var used = [];
  var xi = [];
  slots.forEach(function (slot) {
    var found = null;
    for (var i = 0; i < pool.length; i++) {
      if (used.indexOf(pool[i]) < 0 && pool[i].role === slot.role) { found = pool[i]; break; }
    }
    if (!found) {
      for (var j = 0; j < pool.length; j++) {
        if (used.indexOf(pool[j]) < 0 && pool[j].role !== 'GK') { found = pool[j]; break; }
      }
    }
    if (!found) found = genPlayer(slot.role, 60);
    used.push(found);
    xi.push(found);
  });
  return xi;
}

// user-picked lineup: save.lineupIds is SLOT-ALIGNED — index i plays formation slot i.
// Auto-repairs: sold/missing players are replaced, and a real keeper is always in goal.
function pickUserXI(squadData, slots) {
  if (!save.lineupIds || save.lineupIds.length !== slots.length) return pickXI(squadData, slots);
  var byId = {};
  squadData.forEach(function (p) { byId[p.id] = p; });
  var used = [], xi = new Array(slots.length);
  var i, j;
  for (i = 0; i < slots.length; i++) {
    var cand = byId[save.lineupIds[i]];
    if (cand && used.indexOf(cand) < 0) { xi[i] = cand; used.push(cand); }
    else xi[i] = null;
  }
  var rest = squadData.filter(function (p) { return used.indexOf(p) < 0; })
    .sort(function (a, b) { return b.ovr - a.ovr; });
  for (i = 0; i < slots.length; i++) {
    if (!xi[i]) {
      var found = null;
      for (j = 0; j < rest.length; j++) { if (rest[j].role === slots[i].role) { found = rest[j]; break; } }
      if (!found) {
        for (j = 0; j < rest.length; j++) {
          if (slots[i].role === 'GK' ? rest[j].role === 'GK' : rest[j].role !== 'GK') { found = rest[j]; break; }
        }
      }
      if (!found) found = rest[0] || genPlayer(slots[i].role, 60);
      xi[i] = found;
      var ri = rest.indexOf(found);
      if (ri >= 0) rest.splice(ri, 1);
    }
  }
  // never without a proper keeper
  var gkIdx = 0;
  for (i = 0; i < slots.length; i++) if (slots[i].role === 'GK') gkIdx = i;
  if (xi[gkIdx].role !== 'GK') {
    var bestGK = null;
    for (i = 0; i < squadData.length; i++) {
      var q = squadData[i];
      if (q.role === 'GK' && xi.indexOf(q) < 0 && (!bestGK || q.ovr > bestGK.ovr)) bestGK = q;
    }
    if (bestGK) xi[gkIdx] = bestGK;
  }
  return xi;
}

// human-readable position for a formation slot (LB, CB, DM, ST, ...)
function slotLabel(slot) {
  if (slot.role === 'GK') return 'GK';
  var z = slot.z;
  if (slot.role === 'DF') return Math.abs(z) > 0.5 ? (z < 0 ? 'LB' : 'RB') : 'CB';
  if (slot.role === 'MF') {
    if (Math.abs(z) > 0.45) return z < 0 ? 'LM' : 'RM';
    return slot.x > -0.2 ? 'AM' : slot.x < -0.36 ? 'DM' : 'CM';
  }
  return Math.abs(z) > 0.4 ? (z < 0 ? 'LW' : 'RW') : 'ST';
}

var home = null, away = null, teams = [];
function otherTeam(t) { return t === home ? away : home; }
function allPlayers() { return home.players.concat(away.players); }

// the next fixture: a pending cup tie, or the next league opponent
function currentFixture() {
  if (save.cupPending) {
    return { type: 'cup', opp: save.cupPending.opp, round: save.cupPending.round, stage: save.cupPending.stage || 'ko' };
  }
  if (save.cwcPending) return { type: 'cwc', opp: save.cwcPending.opp, round: save.cwcPending.round };
  if (save.wcPending) return { type: 'wc', opp: save.wcPending.opp, round: save.wcPending.round };
  var oppName = save.schedule[Math.min(save.md, save.schedule.length - 1)];
  return { type: 'league', opp: oppName };
}
function fixtureTitle(fx) {
  if (fx.type === 'cup') {
    return fx.stage === 'group' ?
      CUP_NAME + ' — Group Stage · Match ' + (fx.round + 1) + ' of 3' :
      CUP_NAME + ' — ' + CUP_ROUND_NAMES[fx.round];
  }
  if (fx.type === 'cwc') return 'CLUB WORLD CUP — ' + (fx.round === 0 ? 'Semi-final' : 'FINAL');
  if (fx.type === 'wc') return 'WORLD CUP — ' + ['Quarter-final', 'Semi-final', 'FINAL'][fx.round];
  return ownDivisionName() + ' — Matchday ' + (save.md + 1) + ' of ' + SEASON_MDS;
}

function setupMatch() {
  refreshMarket();
  assignNumbers(save.squad);
  if (home) home.destroy();
  if (away) away.destroy();
  var fx = currentFixture();
  match.fixture = fx;
  var oppDef = clubDefByName(fx.opp);
  rollWeather();
  if (fx.type === 'wc') {
    // World Cup: you take charge of the Meridia national team
    home = new Team(MERIDIA_DEF, 1, true);
    home.mentality = save.mentality;
    if (!save.wc.squad) { save.wc.squad = genClubSquad(79); assignNumbers(save.wc.squad); }
    home.build(save.wc.squad, MERIDIA_DEF.formation);
  } else {
    var hardyDef = save.kitColor ?
      Object.assign({}, HARDY_DEF, { color: save.kitColor, sock: save.kitColor }) : HARDY_DEF;
    home = new Team(hardyDef, 1, true);
    home.mentality = save.mentality;
    home.build(save.squad, save.formation);
  }
  away = new Team(oppDef, -1, false);
  var oppSquad = genClubSquad(oppDef.strength, usedNamesFromSquad());
  assignNumbers(oppSquad);
  away.build(oppSquad, oppDef.formation);
  teams = [home, away];
  // scoreboard
  el.sbHomeName.textContent = home.short;
  el.sbAwayName.textContent = away.short;
  el.sbHomeSwatch.style.background = '#' + home.def.color.toString(16).padStart(6, '0');
  el.sbAwaySwatch.style.background = '#' + oppDef.color.toString(16).padStart(6, '0');
  el.scoreHome.textContent = '0';
  el.scoreAway.textContent = '0';
  controlledPlayer = null;
  pickControlledPlayer();
}

// live formation change: re-map current on-pitch players to new slots
function reassignSlots(team, formationName) {
  var slots = FORMATIONS[formationName];
  if (!slots || !team || team.players.length === 0) return;
  var pool = team.players.slice();
  var assigned = [];
  slots.forEach(function (slot) {
    var found = null;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].role === slot.role) { found = pool[i]; break; }
    }
    if (!found && pool.length) found = pool[0];
    if (found) {
      pool.splice(pool.indexOf(found), 1);
      found.slot = slot;
      assigned.push(found);
    }
  });
  // leftover players (if fewer slots after send-offs) keep their old slot
}

// ---------- Referee ----------
var refMats = {
  kit: new THREE.MeshLambertMaterial({ color: 0x212121 }),
  shorts: new THREE.MeshLambertMaterial({ color: 0x212121 }),
  sock: new THREE.MeshLambertMaterial({ color: 0x212121 })
};
var referee = {
  pos: new THREE.Vector3(0, 0, 8),
  vel: new THREE.Vector3(),
  facing: new THREE.Vector3(1, 0, 0),
  runPhase: 0,
  human: makeHuman(refMats.kit, refMats.shorts, refMats.sock),
  cardTimer: 0
};
scene.add(referee.human.group);
var cardMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.16, 0.24),
  new THREE.MeshBasicMaterial({ color: 0xfdd835, side: THREE.DoubleSide })
);
cardMesh.visible = false;
cardMesh.position.set(0.32, 2.15, 0);
referee.human.group.add(cardMesh);

function updateReferee(dt, frozen) {
  var r = referee;
  if (r.cardTimer > 0) {
    r.cardTimer -= dt;
    cardMesh.visible = true;
    if (r.cardTimer <= 0) cardMesh.visible = false;
  }
  var tx, tz;
  if (frozen && pendingRestart) { tx = pendingRestart.spot.x; tz = pendingRestart.spot.z; }
  else {
    tx = clamp(ball.pos.x + (0 - ball.pos.x) * 0.18 - 6, -HALF_L + 2, HALF_L - 2);
    tz = clamp(ball.pos.z + (0 - ball.pos.z) * 0.18 + 7, -HALF_W + 2, HALF_W - 2);
  }
  var d = new THREE.Vector3(tx - r.pos.x, 0, tz - r.pos.z);
  var dl = d.length();
  var sp = 0;
  if (dl > 1.2) {
    d.normalize();
    sp = Math.min(6.4, dl * 1.5);
    r.pos.addScaledVector(d, sp * dt);
    r.facing.lerp(d, clamp(6 * dt, 0, 1)).normalize();
  }
  r.runPhase += dt * (2 + sp * 3.5);
  animateHuman(r.human, sp, r.runPhase, false);
  if (r.cardTimer > 0) r.human.armR.rotation.x = -2.9;
  r.human.group.position.set(r.pos.x, 0, r.pos.z);
  r.human.group.rotation.y = Math.atan2(r.facing.x, r.facing.z);
}

// ---------- Controlled indicator ----------
var ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 24),
  new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.03;
scene.add(ring);
var marker = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 4),
  new THREE.MeshBasicMaterial({ color: 0xffd54f }));
marker.rotation.x = Math.PI;
scene.add(marker);
var controlledPlayer = null;

// ---------- Set-piece trajectory preview (penalties & free kicks) ----------
var AIM_MAX = 64;
var aimGeom = new THREE.BufferGeometry();
aimGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AIM_MAX * 3), 3));
var aimLine = new THREE.Line(aimGeom, new THREE.LineDashedMaterial({
  color: 0xff1f1f, transparent: true, opacity: 0.95, dashSize: 0.6, gapSize: 0.35
}));
aimLine.frustumCulled = false;
aimLine.visible = false;
scene.add(aimLine);
var setPieceAim = null;      // {taker, spot} while a user penalty/free kick is being lined up

function updateAimLine() {
  var active = setPieceAim && ball.carrier === setPieceAim.taker &&
    dist2d(setPieceAim.taker.pos.x, setPieceAim.taker.pos.z, setPieceAim.spot.x, setPieceAim.spot.z) < 3.5;
  // while a free kick or penalty is being lined up, defenders may NOT touch the ball:
  // keep the restart protection alive so pressing and tackling stay suspended
  if (active) ball.restartProtect = Math.max(ball.restartProtect, 0.4);
  if (!active) {
    aimLine.visible = false;
    if (setPieceAim && ball.carrier !== setPieceAim.taker) setPieceAim = null;
    return;
  }
  var p = setPieceAim.taker;
  var dir = inputDir();
  var charge = (chargingP === p) ? shotCharge : 0.2;
  // mirror doShot's math, minus the random error — this is the intended flight
  var goalX = p.team.attackDir * HALF_L;
  var aimZ = clamp((dir.lengthSq() > 0 ? dir.z : 0) * 3.2, -GOAL_W / 2 + 0.4, GOAL_W / 2 - 0.4);
  var to = new THREE.Vector3(goalX - p.pos.x, 0, aimZ - p.pos.z);
  var d = to.length();
  var power = clamp((15 + d * 0.35 + p.data.shoot * 0.04) * (0.72 + 0.55 * charge), 12, 33);
  var lift = clamp(2.0 + d * 0.09 + charge * 1.6, 1.0, 7.0);
  var hmA = heightMod(p);
  if (hmA === 'low') { lift = clamp(lift * 0.3, 0.5, 1.5); power *= 1.12; }
  else if (hmA === 'high') { lift = clamp(lift * 1.9, 4.2, 8.5); power *= 0.85; }
  to.normalize();
  var px = ball.pos.x, py = Math.max(ball.pos.y, BALL_R), pz = ball.pos.z;
  var vx = to.x * power, vy = lift, vz = to.z * power;
  var arr = aimGeom.attributes.position.array;
  var n = 0, step = 0.05;
  for (var i = 0; i < AIM_MAX; i++) {
    arr[n * 3] = px; arr[n * 3 + 1] = py; arr[n * 3 + 2] = pz;
    n++;
    vy += GRAVITY * step;
    vx -= vx * 0.15 * step;
    vz -= vz * 0.15 * step;
    px += vx * step; py += vy * step; pz += vz * step;
    if (py < 0.05 || Math.abs(px) > HALF_L + 1.6) break;
  }
  aimGeom.attributes.position.needsUpdate = true;
  aimGeom.setDrawRange(0, n);
  aimLine.computeLineDistances();
  aimLine.visible = n > 1;
}

// ---------- Input ----------
var keys = {};
var justPressed = {};
window.addEventListener('keydown', function (e) {
  if (e.target && e.target.tagName === 'INPUT') return;   // typing a name, not playing
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
  if (!keys[e.code]) justPressed[e.code] = true;
  keys[e.code] = true;
  startAudio();
  hideStartOverlay();
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });

function inputDir() {
  if (touchDirActive) return touchDir.clone();
  var x = 0, z = 0;
  if (keys['KeyW'] || keys['ArrowUp']) z -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) z += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) x += 1;
  var v = new THREE.Vector3(x, 0, z);
  if (v.lengthSq() > 0) v.normalize();
  return v;
}

// ---------- Touch controls (FIFA-Mobile style) ----------
var touchMode = ('ontouchstart' in window) || location.hash === '#touch';
var touchDir = new THREE.Vector3();
var touchDirActive = false;
(function () {
  var ui = document.getElementById('touch-ui');
  if (!ui) return;
  if (touchMode) ui.className = 'on';
  // buttons → synthetic keys (hold-to-charge works through keys[])
  var btns = ui.querySelectorAll('.tbtn');
  for (var i = 0; i < btns.length; i++) {
    (function (b) {
      var code = b.getAttribute('data-key');
      if (!code) return;
      b.addEventListener('touchstart', function (e) {
        e.preventDefault();
        startAudio(); hideStartOverlay();
        if (!keys[code]) justPressed[code] = true;
        keys[code] = true;
      }, { passive: false });
      var release = function (e) { e.preventDefault(); keys[code] = false; };
      b.addEventListener('touchend', release, { passive: false });
      b.addEventListener('touchcancel', release, { passive: false });
    })(btns[i]);
  }
  // floating joystick
  var zone = document.getElementById('joy-zone');
  var base = document.getElementById('joy-base');
  var stick = document.getElementById('joy-stick');
  var joyId = null, cx = 0, cy = 0;
  zone.addEventListener('touchstart', function (e) {
    e.preventDefault();
    startAudio(); hideStartOverlay();
    var t = e.changedTouches[0];
    joyId = t.identifier;
    cx = t.clientX; cy = t.clientY;
    base.style.display = 'block';
    base.style.left = cx + 'px';
    base.style.top = cy + 'px';
  }, { passive: false });
  zone.addEventListener('touchmove', function (e) {
    e.preventDefault();
    for (var j = 0; j < e.changedTouches.length; j++) {
      var t = e.changedTouches[j];
      if (t.identifier !== joyId) continue;
      var dx = t.clientX - cx, dy = t.clientY - cy;
      var len = Math.sqrt(dx * dx + dy * dy);
      var max = 52;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      stick.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      if (len > 12) {
        touchDir.set(dx, 0, dy).normalize();
        touchDirActive = true;
      } else {
        touchDirActive = false;
      }
    }
  }, { passive: false });
  var joyEnd = function (e) {
    for (var j = 0; j < e.changedTouches.length; j++) {
      if (e.changedTouches[j].identifier === joyId) {
        joyId = null;
        touchDirActive = false;
        base.style.display = 'none';
        stick.style.transform = 'translate(-50%, -50%)';
      }
    }
  };
  zone.addEventListener('touchend', joyEnd);
  zone.addEventListener('touchcancel', joyEnd);
})();
function updateTouchContext() {
  if (!touchMode) return;
  var attacking = ball.carrier && ball.carrier.team === home;
  var atk = document.getElementById('touch-attack');
  var def = document.getElementById('touch-defense');
  if (atk) atk.style.display = attacking ? 'block' : 'none';
  if (def) def.style.display = attacking ? 'none' : 'block';
}

// ---------- Gamepad (controller) support ----------
// Left stick move · A pass · B shoot (hold for power) · X skill · Y through
// RB slide · RT sprint · LB switch · Start continue
function vkey(code, on) {
  if (on && !keys[code]) { keys[code] = true; justPressed[code] = true; }
  else if (!on && keys[code]) { keys[code] = false; }
}
function pollGamepad() {
  var gps = (navigator.getGamepads && navigator.getGamepads()) || [];
  var g = null;
  for (var i = 0; i < gps.length; i++) if (gps[i] && gps[i].connected) { g = gps[i]; break; }
  if (!g) return;
  var ax = g.axes[0] || 0, ay = g.axes[1] || 0;
  vkey('KeyA', ax < -0.35); vkey('KeyD', ax > 0.35);
  vkey('KeyW', ay < -0.35); vkey('KeyS', ay > 0.35);
  function btn(i2) { return !!(g.buttons[i2] && (g.buttons[i2].pressed || g.buttons[i2].value > 0.4)); }
  vkey('Space', btn(0));       // A — pass / throw / tackle
  vkey('KeyK', btn(1));        // B — shoot (hold to charge)
  vkey('KeyQ', btn(2));        // X — skill move
  vkey('KeyL', btn(3));        // Y — through ball
  vkey('KeyC', btn(4));        // LB — switch player
  vkey('KeyJ', btn(5));        // RB — sliding tackle
  vkey('ShiftLeft', btn(7) || btn(6));   // triggers — sprint
  vkey('Digit6', btn(9));      // Start — continue
  var any = false;
  for (var b = 0; b < g.buttons.length; b++) if (btn(b)) { any = true; break; }
  if (any) { startAudio(); hideStartOverlay(); }
}

// ---------- Audio ----------
var AC = null, crowdGain = null, crowdExcite = 0;
function startAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    var len = AC.sampleRate * 2;
    var buf = AC.createBuffer(1, len, AC.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    var src = AC.createBufferSource();
    src.buffer = buf; src.loop = true;
    var lp = AC.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    crowdGain = AC.createGain();
    crowdGain.gain.value = 0.05;
    src.connect(lp); lp.connect(crowdGain); crowdGain.connect(AC.destination);
    src.start();
  } catch (e) {}
}
function whistle(n) {
  if (!AC) return;
  var t = AC.currentTime;
  for (var i = 0; i < n; i++) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = 'square'; o.frequency.value = 2200;
    g.gain.setValueAtTime(0.06, t + i * 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.18);
    o.connect(g); g.connect(AC.destination);
    o.start(t + i * 0.25); o.stop(t + i * 0.25 + 0.2);
  }
}
function kickSound(power) {
  if (!AC) return;
  var t = AC.currentTime;
  var o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
  g.gain.setValueAtTime(clamp(power / 28, 0.05, 0.3), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g); g.connect(AC.destination);
  o.start(t); o.stop(t + 0.12);
}
function exciteCrowd(a) { crowdExcite = Math.max(crowdExcite, a); }

// ---------- HUD ----------
var el = {
  scoreHome: document.getElementById('score-home'),
  scoreAway: document.getElementById('score-away'),
  clock: document.getElementById('clock'),
  pName: document.getElementById('p-name'),
  pNum: document.getElementById('p-num'),
  pMeta: document.getElementById('p-meta'),
  stamina: document.getElementById('stamina'),
  message: document.getElementById('message'),
  submessage: document.getElementById('submessage'),
  controls: document.getElementById('controls'),
  startOverlay: document.getElementById('start-overlay'),
  startTitle: document.getElementById('start-title'),
  startSub: document.getElementById('start-sub'),
  leaguePanel: document.getElementById('league-panel'),
  leagueTable: document.getElementById('league-table'),
  leagueMd: document.getElementById('league-md'),
  sbHomeName: document.getElementById('sb-home-name'),
  sbAwayName: document.getElementById('sb-away-name'),
  sbHomeSwatch: document.getElementById('sb-home-swatch'),
  sbAwaySwatch: document.getElementById('sb-away-swatch'),
  menuPanel: document.getElementById('menu-panel'),
  menuBody: document.getElementById('menu-body'),
  menuBudget: document.getElementById('menu-budget'),
  menuTabs: document.getElementById('menu-tabs'),
  menuClose: document.getElementById('menu-close'),
  menuButton: document.getElementById('menu-button'),
  power: document.getElementById('power'),
  simButton: document.getElementById('sim-button'),
  simOverlay: document.getElementById('sim-overlay'),
  simFill: document.getElementById('sim-fill'),
  minimap: document.getElementById('minimap'),
  commentary: document.getElementById('commentary'),
  statsPanel: document.getElementById('stats-panel')
};
var minimapCtx = el.minimap.getContext('2d');

// ---------- Play-by-play commentary (text + synthesized VOICE) ----------
// The commentator SPEAKS through the browser's built-in text-to-speech.
var voiceEnabled = !(save && save.voiceOff);
var commVoice = null;
var analystVoice = null;
function pickVoice() {
  if (!window.speechSynthesis) return;
  var vs = speechSynthesis.getVoices();
  if (!vs || !vs.length) return;
  var en = [];
  for (var i = 0; i < vs.length; i++) {
    if (/en[-_]GB/i.test(vs[i].lang)) en.push(vs[i]);
  }
  for (var j = 0; j < vs.length; j++) {
    if (/^en/i.test(vs[j].lang) && en.indexOf(vs[j]) < 0) en.push(vs[j]);
  }
  if (!en.length) en = vs.slice();
  commVoice = en[0];
  analystVoice = en.length > 1 ? en[1] : en[0];   // the co-commentator
}
if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
var lastComment = '';
var commentTimer = 0;
var lastMinorAt = -99;
// priority: 1 = chatter (skipped if busy), 2 = big moment, 3 = GOAL (interrupts)
// emotional register → voice prosody (rate / pitch / volume)
var EMOTIONS = {
  analyst:  { rate: 0.97, pitch: 0.78, vol: 0.95 },
  calm:     { rate: 1.0,  pitch: 0.95, vol: 0.85 },
  build:    { rate: 1.12, pitch: 1.05, vol: 0.95 },
  tense:    { rate: 1.02, pitch: 1.12, vol: 0.95 },
  excited:  { rate: 1.26, pitch: 1.3,  vol: 1 },
  euphoric: { rate: 1.32, pitch: 1.45, vol: 1 },
  drama:    { rate: 0.96, pitch: 1.15, vol: 1 },
  sad:      { rate: 0.88, pitch: 0.8,  vol: 0.9 }
};
function mkUtter(text, emo) {
  var p = EMOTIONS[emo] || EMOTIONS.build;
  var u = new SpeechSynthesisUtterance(text);
  var v = (emo === 'analyst') ? (analystVoice || commVoice) : commVoice;
  if (v) u.voice = v;
  // tiny human variance so no two calls sound identical
  u.rate = p.rate + rand(-0.04, 0.04);
  u.pitch = p.pitch + rand(-0.05, 0.05);
  u.volume = p.vol;
  return u;
}
// speak a sequence of phrases, each with its own emotion (natural pauses between)
function sayParts(parts, priority) {
  if (!parts || !parts.length) return;
  priority = priority || 1;
  var full = parts.map(function (p) { return p.t; }).join(' ');
  if (!full || full === lastComment) return;
  var now = performance.now() / 1000;
  if (priority === 1 && now - lastMinorAt < 4.5) return;
  if (priority === 1) lastMinorAt = now;
  lastComment = full;
  el.commentary.textContent = '\ud83c\udf99 ' + full;
  el.commentary.style.opacity = 1;
  commentTimer = Math.max(2.6, full.length * 0.07);
  if (voiceEnabled && window.speechSynthesis) {
    try {
      if (priority >= 3) speechSynthesis.cancel();
      else if (speechSynthesis.speaking || speechSynthesis.pending) {
        if (priority === 1) return;
        speechSynthesis.cancel();
      }
      parts.forEach(function (p) { speechSynthesis.speak(mkUtter(p.t, p.e)); });
    } catch (e) {}
  }
}
function say(text, priority, emotion) {
  if (emotion === true) emotion = 'excited';
  sayParts([{ t: text, e: emotion || 'calm' }], priority);
}
function pickT(arr) { return arr[(Math.random() * arr.length) | 0]; }
// the co-commentator weighs in after big moments
var COLOR_LINES = {
  goalFor: ['Take nothing away from that finish — emphatic.', 'The movement in the box was superb, you know.', 'That is what he is in the team for.', 'Great goal. No keeper in the world saves that.'],
  goalAgainst: ['For me, the defending just was not good enough.', 'Somebody has to pick up that runner.', 'You simply cannot switch off at this level.', 'The manager will not be happy with that one.'],
  save: ['Great positioning from the keeper — strong hands.', 'He made himself big. Textbook.', 'The striker will feel he should have scored, mind.'],
  red: ['Reckless. You just cannot make that challenge.', 'No arguments. He had to go.', 'A moment of madness, and his team pay the price.'],
  miss: ['He had the whole goal to aim at.', 'On another day that flies in.', 'The composure just deserted him there.'],
  penalty: ['Clear penalty for me. No doubt about it.', 'The defender got it all wrong there.', 'Brave from the referee, but the right call.']
};
function colorPart(kind) {
  var lines = COLOR_LINES[kind];
  if (!lines || Math.random() > 0.6) return null;
  return { t: pickT(lines), e: 'analyst' };
}
// generic flavor kinds kept for simple events
var COMMENT_LINES = {
  post: ['Ohhhh! Off the woodwork!', 'The frame of the goal rescues them!', 'He has rattled the post — inches away!'],
  kickoff: ['And we are underway!', 'The referee gets us started!', 'Here we go then!'],
  chance: ['A sight of goal here...', 'Shooting chance!', 'Space opens up...']
};
function commentate(kind) {
  var lines = COMMENT_LINES[kind];
  if (lines) say(pickT(lines), kind === 'post' ? 2 : 1, kind === 'post' ? 'excited' : 'build');
}
// named play-by-play helpers
function sayPass(a, b) {
  say(pickT([
    a + '... finds ' + b + '.',
    a + ' slides it into ' + b + '.',
    'Nice ball from ' + a + ' to ' + b + '.',
    a + ' picks out ' + b + '.'
  ]), 1, false);
}
function sayShot(name, far) {
  say(far ? pickT([name + ' tries his luck from range...', 'Ambitious from ' + name + '...', name + ' lets fly from distance...'])
          : pickT([name + ' shoots!', name + ' pulls the trigger!', 'Strike from ' + name + '!']), 2, far ? 'build' : 'excited');
}
function saySave(keeper) {
  var parts = [{ t: pickT(['Kept out! ' + keeper + ' with the save!', 'What a stop by ' + keeper + '!', keeper + ' says no!', 'Ohhh, brilliant from ' + keeper + ' in goal!']), e: 'excited' }];
  var col = colorPart('save');
  if (col) parts.push(col);
  sayParts(parts, 2);
}
function sayGoal(scorerObjName, team, scoringTeam) {
  var scorer = scorerObjName;
  var scoreline = home.short + ' ' + home.score + ', ' + away.short + ' ' + away.score + '.';
  var userScored = scoringTeam === home;
  var late = match.half === 2 && match.clock > HALF_REAL_SECONDS * 0.78;
  var diff = home.score - away.score;
  var nGoals = (match.scorerCounts && scorer) ? match.scorerCounts[scorer] || 0 : 0;
  if (userScored) {
    var burst = pickT(['GOOOOAL!', 'GOAL! GOAL! GOAL!', 'IT IS IN!', 'GOOOAL! WHAT A MOMENT!']);
    var line;
    if (nGoals >= 3) line = 'HAT-TRICK! A HAT-TRICK FOR ' + scorer + '! Sensational!';
    else if (late && diff === 1) line = 'UNBELIEVABLE! A late, late winner from ' + (scorer || team) + '!';
    else if (diff === 0) line = (scorer || team) + ' with the equaliser! Game on!';
    else if (nGoals === 2) line = scorer + ' again! His second of the match!';
    else line = scorer ? scorer + ' for ' + team + '! Magnificent!' : team + ' score!';
    var parts = [
      { t: burst, e: 'euphoric' },
      { t: line, e: 'euphoric' },
      { t: scoreline, e: 'excited' }
    ];
    var col = colorPart('goalFor');
    if (col) parts.push(col);
    sayParts(parts, 3);
  } else {
    var parts2 = [
      { t: pickT(['Ohh no...', 'Oh dear...', 'And that is a blow.']), e: 'sad' },
      { t: (scorer ? scorer + ' scores for ' + team + '.' : team + ' score.'), e: 'sad' },
      { t: scoreline, e: 'calm' }
    ];
    var col2 = colorPart('goalAgainst');
    if (col2) parts2.push(col2);
    sayParts(parts2, 3);
  }
}
function sayTackle(name, slide) {
  say(slide ? pickT([name + ' flies in — wins it clean!', 'Sliding challenge from ' + name + ' — superb!'])
            : pickT([name + ' wins it back.', 'Good strength from ' + name + '.', name + ' steps in and takes it.']), 1, false);
}
function sayTrick(name) {
  say(pickT(['Ohh, lovely feet from ' + name + '!', name + ' dances past his man!', 'Beautiful skill by ' + name + '!']), 2, 'excited');
}
function sayFoul(name, card, fromBehind) {
  if (card === 'red') {
    var rparts = [
      { t: fromBehind ? 'Straight through the back of him! That is horrible!' : 'Oh, this looks bad...', e: 'drama' },
      { t: 'He is OFF! ' + name + ' sees red!', e: 'excited' }
    ];
    var rcol = colorPart('red');
    if (rcol) rparts.push(rcol);
    sayParts(rparts, 3);
  }
  else if (card === 'yellow') say(name + ' goes into the book.', 2, 'drama');
  else say(pickT([name + ' catches his man — free kick.', 'The referee blows. Foul by ' + name + '.']), 2, 'build');
}
function sayOffside(name) {
  say(pickT(['The flag is up against ' + name + '!', name + ' strayed offside.', 'Caught beyond the line — ' + name + ' offside.']), 2, false);
}
function saySub(inN, outN) {
  say('Substitution: ' + inN + ' comes on for ' + outN + '.', 2, false);
}
var fillerTimer = rand(12, 20);
function updateFiller(dt) {
  if (match.state !== 'play' || trainingMode) return;
  fillerTimer -= dt;
  if (fillerTimer > 0) return;
  fillerTimer = rand(14, 24);
  if (!ball.carrier) return;
  var c = ball.carrier;
  var lateGame = match.half === 2 && match.clock > HALF_REAL_SECONDS * 0.7;
  var diff2 = home.score - away.score;
  var pool;
  if (lateGame && diff2 < 0) pool = [
    home.name + ' are chasing it now — time is running out.',
    'They need something special, and they need it soon.',
    c.name + ' on the ball... ' + home.name + ' throwing bodies forward.'
  ];
  else if (lateGame && diff2 > 0) pool = [
    home.name + ' seeing this out very professionally.',
    c.name + ' keeps it moving. Smart game management.',
    'The clock is their friend now.'
  ];
  else if (match.clock < HALF_REAL_SECONDS * 0.15 && match.half === 1) pool = [
    'Early stages here at Meridian Park.',
    'Both sides still feeling each other out.',
    c.name + ' on the ball, probing for an opening.'
  ];
  else pool = [
    c.name + ' in possession for ' + c.team.name + '.',
    c.team.name + ' patient in the build-up. ' + c.name + ' on the ball.',
    c.name + ' looks up, weighing his options.',
    'Still ' + home.short + ' ' + home.score + ', ' + away.short + ' ' + away.score + '. ' + c.name + ' carries it forward.',
    'Good tempo to this match.',
    c.name + ' switches the point of attack.'
  ];
  say(pickT(pool), 1, 'calm');
}
function updateCommentary(dt) {
  updateFiller(dt);
  if (commentTimer > 0) {
    commentTimer -= dt;
    if (commentTimer <= 0) el.commentary.style.opacity = 0;
  }
}

// ---------- Instant replay (last ~2s before a goal, slow motion) ----------
var replayBuf = [];
var REPLAY_KEEP = 150;
function recordReplayFrame() {
  var f = { b: [ball.pos.x, ball.pos.y, ball.pos.z], p: [] };
  allPlayers().forEach(function (pl) {
    f.p.push([pl.pos.x, pl.pos.z, pl.mesh.rotation.y]);
  });
  replayBuf.push(f);
  if (replayBuf.length > REPLAY_KEEP) replayBuf.shift();
}
function startReplay() {
  if (replayBuf.length < 30) return;
  match.replay = { frames: replayBuf.slice(-120), i: 0 };
  el.commentary.textContent = '▶ REPLAY';
  el.commentary.style.opacity = 1;
  commentTimer = 3.5;
}
function updateReplay() {
  var r = match.replay;
  if (!r) return false;
  var f = r.frames[Math.floor(r.i)];
  if (!f) { match.replay = null; return false; }
  var ps = allPlayers();
  for (var i = 0; i < ps.length && i < f.p.length; i++) {
    ps[i].mesh.position.set(f.p[i][0], 0, f.p[i][1]);
    ps[i].mesh.rotation.y = f.p[i][2];
  }
  ballMesh.position.set(f.b[0], f.b[1], f.b[2]);
  r.i += 0.55;                                   // slow motion
  if (r.i >= r.frames.length) {
    match.replay = null;
    return false;
  }
  return true;
}

// ---------- Minimap radar ----------
function cssColor(hex) { return '#' + hex.toString(16).padStart(6, '0'); }
function updateMinimap() {
  if (!teams.length) return;
  var c = minimapCtx, W = 210, H = 136;
  c.clearRect(0, 0, W, H);
  c.fillStyle = 'rgba(18,48,22,.92)';
  c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,.4)';
  c.lineWidth = 1;
  c.strokeRect(4, 4, W - 8, H - 8);
  c.beginPath(); c.moveTo(W / 2, 4); c.lineTo(W / 2, H - 4); c.stroke();
  c.beginPath(); c.arc(W / 2, H / 2, 10, 0, Math.PI * 2); c.stroke();
  function mx(x) { return 5 + (x + HALF_L) * (W - 10) / FIELD_L; }
  function mz(z) { return 5 + (z + HALF_W) * (H - 10) / FIELD_W; }
  teams.forEach(function (t) {
    c.fillStyle = cssColor(t.def.color);
    t.players.forEach(function (p) {
      c.beginPath();
      c.arc(mx(p.pos.x), mz(p.pos.z), 2.4, 0, Math.PI * 2);
      c.fill();
    });
  });
  if (controlledPlayer) {
    c.strokeStyle = '#ffd54f';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(mx(controlledPlayer.pos.x), mz(controlledPlayer.pos.z), 4, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(mx(ball.pos.x), mz(ball.pos.z), 2, 0, Math.PI * 2);
  c.fill();
}
var msgTimer = 0;
function showMessage(mainHTML, sub, seconds) {
  el.message.innerHTML = mainHTML;
  el.submessage.textContent = sub || '';
  el.message.style.opacity = 1;
  el.submessage.style.opacity = sub ? 1 : 0;
  msgTimer = seconds || 2;
}
function cardChip(color) { return '<span class="chip" style="background:' + color + '"></span>'; }
function hideStartOverlay() {
  if (el.startOverlay.style.display !== 'none') {
    el.startOverlay.style.display = 'none';
    whistle(1);
  }
}
el.startOverlay.addEventListener('click', function () { startAudio(); hideStartOverlay(); });

// ---------- Leagues, cup & world simulation ----------
function pts(row) { return row.W * 3 + row.D; }
function recordResultIn(table, a, b, ga, gb) {
  var A = table[a], B = table[b];
  if (!A || !B) return;
  A.P++; B.P++; A.GF += ga; A.GA += gb; B.GF += gb; B.GA += ga;
  if (ga > gb) { A.W++; B.L++; A.form.push('W'); B.form.push('L'); }
  else if (gb > ga) { B.W++; A.L++; B.form.push('W'); A.form.push('L'); }
  else { A.D++; B.D++; A.form.push('D'); B.form.push('D'); }
  if (A.form.length > 5) A.form.shift();
  if (B.form.length > 5) B.form.shift();
}
function strengthOf(name) {
  if (DOMESTIC[name]) return DOMESTIC[name].strength;
  for (var i = 0; i < FOREIGN_LEAGUES.length; i++) {
    var c = FOREIGN_LEAGUES[i].clubs.filter(function (x) { return x.name === name; })[0];
    if (c) return c.str;
  }
  return 68;
}
function simGoalsBetween(sa, sb) {
  var exp = 1.35 * Math.pow(sa / sb, 3);
  var g = 0, pr = clamp(exp * 0.5, 0.05, 0.9);
  while (Math.random() < pr && g < 6) { g++; pr *= 0.5; }
  return g;
}
function simRound(table, names, excludeA, excludeB) {
  var pool = shuffled(names.filter(function (n) { return n !== excludeA && n !== excludeB; }));
  for (var k = 0; k + 1 < pool.length; k += 2) {
    var a = pool[k], b = pool[k + 1];
    recordResultIn(table, a, b, simGoalsBetween(strengthOf(a), strengthOf(b)), simGoalsBetween(strengthOf(b), strengthOf(a)));
  }
}
// after each of the user's league matches, the rest of the world plays too
function simulateWorldRound(oppName) {
  var ownKey = ownDivisionKey();
  var otherKey = ownKey === 'd1' ? 'd2' : 'd1';
  simRound(save.tables[ownKey], save.divisions[ownKey], HARDY_DEF.name, oppName);
  simRound(save.tables[otherKey], save.divisions[otherKey]);
  FOREIGN_LEAGUES.forEach(function (L) {
    simRound(save.tables[L.key], L.clubs.map(function (c) { return c.name; }));
  });
}
function sortedTableOf(tableKey, names) {
  var rows = names.map(function (n) { return { name: n, r: save.tables[tableKey][n] }; })
    .filter(function (x) { return x.r; });
  rows.sort(function (a, b) {
    var pa = pts(a.r), pb = pts(b.r);
    if (pb !== pa) return pb - pa;
    var gda = a.r.GF - a.r.GA, gdb = b.r.GF - b.r.GA;
    if (gdb !== gda) return gdb - gda;
    return b.r.GF - a.r.GF;
  });
  return rows;
}
var leagueView = 'own';
function leagueViewTabs() {
  var tabs = [
    { id: 'own', label: save.division === 1 ? 'DIV 1' : 'DIV 2' },
    { id: 'other', label: save.division === 1 ? 'DIV 2' : 'DIV 1' },
    { id: 'cup', label: 'CUP' }
  ];
  FOREIGN_LEAGUES.forEach(function (L, i) { tabs.push({ id: 'f' + i, label: L.name.split(' (')[0].toUpperCase() }); });
  return tabs;
}
function formDots(form) {
  var out = '';
  (form || []).forEach(function (f) {
    var c = f === 'W' ? '#66bb6a' : f === 'D' ? '#90a4ae' : '#ef5350';
    out += '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + c + ';margin-left:3px"></span>';
  });
  return out || '<span style="color:#546e7a">—</span>';
}
function renderLeagueTable() {
  var tabsHtml = '<div style="display:flex;gap:6px;justify-content:center;margin-bottom:12px;flex-wrap:wrap">';
  leagueViewTabs().forEach(function (t) {
    tabsHtml += '<span class="btn' + (leagueView === t.id ? ' selected' : '') + '" data-lview="' + t.id + '" style="pointer-events:auto">' + t.label + '</span>';
  });
  tabsHtml += '</div>';

  var html = tabsHtml;
  if (leagueView === 'cup') {
    html += renderCupView();
  } else {
    var tableKey, names, title, zones;
    if (leagueView === 'own') {
      tableKey = ownDivisionKey(); names = save.divisions[tableKey];
      title = ownDivisionName();
      zones = tableKey === 'd1' ? { champ: 1, cup: 8, releg: 3 } : { promo: 3, releg: 0 };
    } else if (leagueView === 'other') {
      tableKey = ownDivisionKey() === 'd1' ? 'd2' : 'd1'; names = save.divisions[tableKey];
      title = tableKey === 'd1' ? 'Meridian League' : 'Meridian League 2';
      zones = tableKey === 'd1' ? { champ: 1, cup: 8, releg: 3 } : { promo: 3, releg: 0 };
    } else {
      var L = FOREIGN_LEAGUES[parseInt(leagueView.slice(1), 10)];
      tableKey = L.key; names = L.clubs.map(function (c) { return c.name; });
      title = L.name;
      zones = { champ: 1 };
    }
    var rows = sortedTableOf(tableKey, names);
    html += '<div style="text-align:center;color:#ffd54f;font-weight:700;letter-spacing:1px;margin-bottom:8px">' + title + '</div>';
    html += '<table><tr><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th style="text-align:left">Form</th></tr>';
    rows.forEach(function (row, i) {
      var r = row.r, gd = r.GF - r.GA;
      var zone = '';
      if (zones.champ && i < zones.champ) zone = 'border-left:3px solid #ffd54f;';
      else if (zones.cup && i < zones.cup) zone = 'border-left:3px solid #4dd0e1;';
      else if (zones.promo && i < zones.promo) zone = 'border-left:3px solid #66bb6a;';
      else if (zones.releg && i >= rows.length - zones.releg) zone = 'border-left:3px solid #ef5350;';
      html += '<tr' + (row.name === HARDY_DEF.name ? ' class="me"' : '') + '>' +
        '<td class="club" style="' + zone + '">' + (i + 1) + '. ' + row.name + '</td>' +
        '<td>' + r.P + '</td><td>' + r.W + '</td><td>' + r.D + '</td><td>' + r.L + '</td>' +
        '<td>' + r.GF + '</td><td>' + r.GA + '</td><td>' + (gd > 0 ? '+' + gd : gd) + '</td>' +
        '<td class="pts">' + pts(r) + '</td><td style="text-align:left">' + formDots(r.form) + '</td></tr>';
    });
    html += '</table>';
    if (leagueView === 'own' || leagueView === 'other') {
      html += '<div style="color:#78909c;font-size:11px;margin-top:8px;text-align:center">' +
        (tableKey === 'd1' ? '<span style="color:#ffd54f">▎</span> champions &nbsp; <span style="color:#4dd0e1">▎</span> Champions Cup (top 8) &nbsp; <span style="color:#ef5350">▎</span> relegated (bottom 3)' :
          '<span style="color:#66bb6a">▎</span> promoted (top 3)') + '</div>';
    }
  }
  el.leagueTable.innerHTML = html;
  el.leagueMd.textContent = 'Season ' + save.season + ' — ' + ownDivisionName() + ' — after matchday ' + save.md + ' of ' + SEASON_MDS;
}
function renderCupView() {
  var c = save.cup;
  var html = '<div style="text-align:center;color:#ffd54f;font-weight:700;letter-spacing:1px;margin-bottom:8px">' + CUP_NAME + '</div>';
  if (!c) {
    return html + '<div class="hint" style="line-height:1.8">Like the real Champions League, the cup is played <b>after the league season</b> (all ' + SEASON_MDS + ' matchdays).<br>' +
      '32 clubs — the <b>top 8 of the Meridian League</b> + the top 8 from Azuria, Valdorra and Norland — are drawn into <b>8 groups of 4</b>.<br>' +
      'The top 2 of every group (16 clubs) reach the Round of 16, then knockout to the final. Division 2 clubs cannot qualify.<br>' +
      (save.lastCupWinner ? 'Holders: <b style="color:#ffd54f">' + save.lastCupWinner + '</b>' : '') + '</div>';
  }
  if (c.stage === 'groups' && !c.done) {
    html += '<div style="text-align:center;color:#90a4ae;font-size:13px;margin-bottom:10px">Group stage — match ' + Math.min(3, c.groupRound + 1) + ' of 3' +
      (c.hardyIn ? ' · <span style="color:#66bb6a;font-weight:700">Hardy FC in Group ' + String.fromCharCode(65 + c.hardyGroup) + '</span>' : '') + '</div>';
    html += '<div style="columns:2;gap:20px;font-size:12px;line-height:1.7">';
    c.groups.forEach(function (g, gi) {
      html += '<div style="break-inside:avoid;margin-bottom:10px"><b style="color:' + (gi === c.hardyGroup ? '#ffd54f' : '#90a4ae') + '">GROUP ' + String.fromCharCode(65 + gi) + '</b>';
      groupStandings(gi).forEach(function (row, ri) {
        var nm = row.name === HARDY_DEF.name ? '<b style="color:#ffd54f">' + row.name + '</b>' : row.name;
        html += '<div style="color:' + (ri < 2 ? '#e0f2f1' : '#607d8b') + '">' + nm + ' — ' + pts(row.r) + ' pts (' + (row.r.GF - row.r.GA > 0 ? '+' : '') + (row.r.GF - row.r.GA) + ')</div>';
      });
      html += '</div>';
    });
    html += '</div><div class="hint" style="margin-top:6px">top 2 of each group (16 clubs) advance to the Round of 16</div>';
    return html;
  }
  html += '<div style="text-align:center;color:#78909c;font-size:12px;margin-bottom:6px">Knockout stage — the 16 group survivors</div>';
  var stage = c.done ? '🏆 Winners: ' + c.winner : (CUP_ROUND_NAMES[c.round] || 'Complete') + ' up next';
  var hardyNote = c.qualified && c.qualified.indexOf(HARDY_DEF.name) < 0 ?
    ' — <span style="color:#ef5350">Hardy FC did not qualify this season</span>' :
    (c.hardyIn ? ' — <span style="color:#66bb6a;font-weight:700">Hardy FC still in it!</span>' : ' — <span style="color:#ef5350">Hardy FC are out</span>');
  html += '<div style="text-align:center;color:#90a4ae;font-size:13px;margin-bottom:10px">' + stage + hardyNote + '</div>';
  html += '<div style="columns:2;font-size:13px;line-height:1.9">';
  c.alive.forEach(function (n) {
    var foreign = !DOMESTIC[n];
    html += '<div style="break-inside:avoid">' + (n === HARDY_DEF.name ? '<b style="color:#ffd54f">' + n + '</b>' :
      (foreign ? '<span style="color:#80cbc4">' + n + '</span>' : n)) + '</div>';
  });
  html += '</div><div class="hint" style="margin-top:8px">' + c.alive.length + ' clubs remain · <span style="color:#80cbc4">teal = foreign club</span> · win the final for ' + fmtM(12) + '</div>';
  return html;
}
el.leagueTable.addEventListener('click', function (e) {
  var v = e.target.getAttribute && e.target.getAttribute('data-lview');
  if (v) { leagueView = v; renderLeagueTable(); }
});
function toggleLeaguePanel(show) {
  var vis = el.leaguePanel.style.display === 'block';
  var want = (show === undefined) ? !vis : show;
  if (want) renderLeagueTable();
  el.leaguePanel.style.display = want ? 'block' : 'none';
}

// ---------- Team menu (mouse-driven) ----------
var menuOpen = false;
var menuTab = 'squad';
var menuAutoPaused = false;

var crestDataURL = (function () {
  var c = document.createElement('canvas');
  c.width = 96; c.height = 112;
  var g = c.getContext('2d');
  // shield
  g.beginPath();
  g.moveTo(8, 8); g.lineTo(88, 8); g.lineTo(88, 62);
  g.quadraticCurveTo(88, 96, 48, 108);
  g.quadraticCurveTo(8, 96, 8, 62);
  g.closePath();
  g.fillStyle = '#b71c1c'; g.fill();
  g.save(); g.clip();
  g.fillStyle = '#e53935';
  for (var i = 0; i < 5; i++) if (i % 2 === 0) g.fillRect(8 + i * 16, 0, 16, 112);
  g.restore();
  g.lineWidth = 4; g.strokeStyle = '#ffd54f'; g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 30px Arial';
  g.textAlign = 'center';
  g.fillText('HFC', 48, 52);
  g.font = 'bold 13px Arial';
  g.fillStyle = '#ffd54f';
  g.fillText('EST. S1', 48, 78);
  return c.toDataURL();
})();
(function () {
  var img = document.createElement('img');
  img.src = crestDataURL;
  img.style.cssText = 'width:34px;height:40px;margin-right:10px';
  var head = document.getElementById('menu-head');
  head.insertBefore(img, head.firstChild);
})();

function openMenu(tab) {
  menuTab = tab || menuTab;
  menuOpen = true;
  el.menuPanel.style.display = 'block';
  if (match.state === 'play' && !match.paused) {
    match.paused = true;
    menuAutoPaused = true;
  }
  renderMenu();
}
function closeMenu() {
  menuOpen = false;
  el.menuPanel.style.display = 'none';
  if (menuAutoPaused) {
    match.paused = false;
    menuAutoPaused = false;
    el.message.style.opacity = 0;
    el.submessage.style.opacity = 0;
  }
}
function posBadge(role) { return '<span class="pos ' + role + '">' + role + '</span>'; }
function traitHTML(p) {
  if (!p.traits || !p.traits.length) return '';
  return '<div style="font-size:10px;color:#4dd0e1;line-height:1.3">⚡' + p.traits.join(' ⚡') + '</div>';
}

function currentXIData() {
  return pickUserXI(save.squad, FORMATIONS[save.formation]);
}
var swapSel = null;    // player id awaiting a lineup swap
var builderState = null;   // create-a-player in progress

function matchIsLive() {
  return home && teams.length > 0 && match.state !== 'fulltime';
}
// live substitution: bench player replaces an on-pitch player at their exact position
function makeSubstitution(outId, inId) {
  if ((match.subsUsed || 0) >= 5) return false;
  var outP = null;
  home.players.forEach(function (p) { if (p.data.id === outId) outP = p; });
  var inData = null;
  save.squad.forEach(function (d) { if (d.id === inId) inData = d; });
  if (!outP || !inData) return false;
  var alreadyOn = false;
  home.players.forEach(function (p) { if (p.data.id === inId) alreadyOn = true; });
  if (alreadyOn) return false;
  var np = new Player(home, outP.slot, inData);
  np.pos.copy(outP.pos);
  np.facing.copy(outP.facing);
  scene.remove(outP.mesh);
  if (ball.carrier === outP) ball.carrier = np;
  if (ball.lastKicker === outP) ball.lastKicker = np;
  if (controlledPlayer === outP) controlledPlayer = np;
  home.players[home.players.indexOf(outP)] = np;
  match.subsUsed = (match.subsUsed || 0) + 1;
  saySub(inData.name, outP.name);
  showMessage('SUBSTITUTION', '⇄ ' + inData.name + ' replaces ' + outP.name + '  (' + match.subsUsed + '/5 subs used)', 2.5);
  return true;
}
// swap two on-pitch players' positions during a match
function swapPitchPositions(idA, idB) {
  var pa = null, pb = null;
  home.players.forEach(function (p) {
    if (p.data.id === idA) pa = p;
    if (p.data.id === idB) pb = p;
  });
  if (!pa || !pb) return;
  var s = pa.slot; pa.slot = pb.slot; pb.slot = s;
  var r = pa.role; pa.role = pb.role; pb.role = r;
}

function renderMenu() {
  el.menuBudget.textContent = 'Budget ' + fmtM(save.budget);
  var tabs = el.menuTabs.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].className = 'tab' + (tabs[i].getAttribute('data-tab') === menuTab ? ' active' : '');
  }
  if (menuTab === 'squad') renderSquadTab();
  else if (menuTab === 'tactics') renderTacticsTab();
  else if (menuTab === 'club') renderClubTab();
  else renderTransfersTab();
}

function renderSquadTab() {
  var xi = currentXIData();
  var rows = save.squad.slice().sort(function (a, b) {
    var ro = { GK: 0, DF: 1, MF: 2, FW: 3 };
    if (ro[a.role] !== ro[b.role]) return ro[a.role] - ro[b.role];
    return b.ovr - a.ovr;
  });
  var live = matchIsLive();
  var html = '<div style="margin-bottom:8px">' +
    '<span class="btn big" data-act="autoxi">↻ Auto-pick best XI</span>' +
    (live ? '<span style="color:#ffd54f;font-weight:700;font-size:13px;margin-left:10px">MATCH LIVE — subs used: ' + (match.subsUsed || 0) + '/5</span>' : '') +
    '<span style="color:' + (swapSel ? '#ffd54f' : '#78909c') + ';font-size:12px;margin-left:10px">' +
    (swapSel ? 'now click ⇄ on the player to swap with…' :
      (live ? 'starter+bench = substitution · starter+starter = swap positions' :
        'click ⇄ on two players: starter+bench swaps who plays, starter+starter swaps positions')) +
    '</span></div>';
  html += '<table><tr><th></th><th class="l">Player</th><th>Pos</th><th class="l">Style</th><th>Age</th><th>OVR</th><th>POT</th><th>PAC</th><th>SHO</th><th>PAS</th><th>DEF</th><th>PHY</th><th>Contract</th><th>Value</th><th></th></tr>';
  rows.forEach(function (p) {
    var idx = save.squad.indexOf(p);
    var starting = xi.indexOf(p) >= 0;
    var expiring = p.contract <= 1;
    var canSell = save.squad.length > 13 && !(p.role === 'GK' && countRole('GK') <= 1);
    var pot = p.pot !== undefined ? p.pot : p.ovr;
    var potHTML = pot > p.ovr ? '<span style="color:#66bb6a;font-weight:700">' + pot + '</span>' : '<span style="color:#78909c">' + pot + '</span>';
    var selStyle = swapSel === p.id ? 'background:rgba(255,213,79,.5);color:#fff' : '';
    var slotIdx = xi.indexOf(p);
    var posLabel = starting ? '<b style="color:#ffd54f">' + slotLabel(FORMATIONS[save.formation][slotIdx]) + '</b>' : posBadge(p.role);
    html += '<tr' + (starting ? ' class="starting"' : '') + '>' +
      '<td><span class="btn" style="' + selStyle + '" data-act="swapsel" data-id="' + p.id + '">⇄</span></td>' +
      '<td class="l">#' + p.num + ' ' + p.name + (starting ? ' ★' : '') + '</td>' +
      '<td>' + posLabel + '</td>' +
      '<td class="l style">' + p.style + traitHTML(p) + '</td>' +
      '<td>' + (p.age || '–') + '</td>' +
      '<td class="ovr">' + p.ovr + '</td>' +
      '<td>' + potHTML + '</td>' +
      '<td>' + p.pace + '</td><td>' + p.shoot + '</td><td>' + p.pass + '</td><td>' + p.def + '</td><td>' + p.phys + '</td>' +
      '<td class="' + (expiring ? 'expiring' : '') + '">' + p.contract + ' season' + (p.contract === 1 ? '' : 's') + '</td>' +
      '<td>' + fmtM(p.value) + '</td>' +
      '<td>' +
        (expiring ? '<span class="btn" data-act="renew" data-i="' + idx + '">Renew ' + fmtM(renewCost(p)) + '</span> ' : '') +
        '<span class="btn sell' + (canSell ? '' : ' disabled') + '" data-act="sell" data-i="' + idx + '">Sell ' + fmtM(sellPrice(p)) + '</span>' +
      '</td></tr>';
  });
  html += '</table><div class="note">★ = in the starting XI. Use the ⇄ buttons to pick who starts (a goalkeeper is always required, so benching your only keeper brings the best one back automatically). ' +
    'POT (in <span style="color:#66bb6a">green</span>) is the player\'s potential — young players grow toward it each season, and players over ~29 decline (pace goes first). ' +
    'Players in <span style="color:#ef5350;font-weight:700">red</span> are in the final season of their contract — renew them or they leave when the season ends. ' +
    'Lineup and squad changes take effect at the next match.</div>';
  el.menuBody.innerHTML = html;
}
function countRole(role) {
  return save.squad.filter(function (p) { return p.role === role; }).length;
}
function renewCost(p) { return Math.max(0.3, Math.round(p.value * 0.25 * 10) / 10); }
function sellPrice(p) { return Math.max(0.2, Math.round(p.value * 0.9 * 10) / 10); }

function renderTacticsTab() {
  var html = '<h3>FORMATION</h3>';
  Object.keys(FORMATIONS).forEach(function (f) {
    html += '<span class="btn big' + (save.formation === f ? ' selected' : '') + '" data-act="formation" data-f="' + f + '">' + f + '</span>';
  });
  html += '<h3>MENTALITY</h3>';
  MENTALITIES.forEach(function (m) {
    html += '<span class="btn big' + (save.mentality === m ? ' selected' : '') + '" data-act="mentality" data-f="' + m + '">' + m.toUpperCase() + '</span>';
  });
  html += '<h3>DIFFICULTY</h3>';
  DIFF_NAMES.forEach(function (n, i) {
    html += '<span class="btn big' + (save.difficulty === i ? ' selected' : '') + '" data-act="difficulty" data-f="' + i + '">' + n.toUpperCase() + '</span>';
  });
  html += '<div class="note">Difficulty changes how SMART opponents are — their passing, finishing, pressing and decision speed — never how fast they run. Applies from the next match.</div>';
  html += '<div class="note">Formation and mentality apply immediately — even mid-match. ' +
    'DEFENSIVE drops your team deeper and presses less; ATTACKING pushes everyone higher and presses with more players. ' +
    'Your starting XI is re-picked for the new formation at the next match.</div>';
  el.menuBody.innerHTML = html;
}

function renderTransfersTab() {
  var canScout = save.budget >= 1;
  var html = '<h3>AVAILABLE TO BUY — scouting network level ' + (save.scoutLvl || 1) + ' · refreshes every matchday</h3>' +
    '<div style="margin-bottom:8px"><span class="btn big buy' + (canScout ? '' : ' disabled') + '" data-act="rescout">🔍 Send scouts for new players — ' + fmtM(1) + '</span></div>' +
    '<table><tr><th class="l">Player</th><th>Pos</th><th class="l">Style</th><th>Age</th><th>OVR</th><th>POT</th><th>PAC</th><th>SHO</th><th>PAS</th><th>DEF</th><th>PHY</th><th class="l">From</th><th>Price</th><th></th></tr>';
  save.market.forEach(function (m, i) {
    var p = m.p;
    var afford = save.budget >= m.price && save.squad.length < 22;
    var pot = p.pot !== undefined ? p.pot : p.ovr;
    var potHTML = pot > p.ovr ? '<span style="color:#66bb6a;font-weight:700">' + pot + '</span>' : '<span style="color:#78909c">' + pot + '</span>';
    html += '<tr>' +
      '<td class="l">' + p.name + '</td>' +
      '<td>' + posBadge(p.role) + '</td>' +
      '<td class="l style">' + p.style + traitHTML(p) + '</td>' +
      '<td>' + (p.age || '–') + '</td>' +
      '<td class="ovr">' + p.ovr + '</td>' +
      '<td>' + potHTML + '</td>' +
      '<td>' + p.pace + '</td><td>' + p.shoot + '</td><td>' + p.pass + '</td><td>' + p.def + '</td><td>' + p.phys + '</td>' +
      '<td class="l">' + m.from + '</td>' +
      '<td>' + fmtM(m.price) + '</td>' +
      '<td><span class="btn buy' + (afford ? '' : ' disabled') + '" data-act="buy" data-i="' + i + '">Buy</span></td></tr>';
  });
  html += '</table><div class="note">New signings get a 3-season contract and join your squad for the next match. Max squad size 22. ' +
    'A better scouting network (see the CLUB tab) finds more and better players — young signings with high <span style="color:#66bb6a">POT</span> grow into stars. ' +
    'Earn money from results: win ' + fmtM(3) + ', draw ' + fmtM(1.5) + ', loss ' + fmtM(0.5) + ', plus cup runs and season prize money.</div>';
  el.menuBody.innerHTML = html;
}

var ACADEMY_COSTS = [0, 5, 10, 20, 35];   // cost to reach level 2,3,4,5
var SCOUT_COSTS = [0, 4, 8, 16, 30];
function renderClubTab() {
  var aLvl = save.academyLvl || 1, sLvl = save.scoutLvl || 1;
  var aCost = ACADEMY_COSTS[aLvl], sCost = SCOUT_COSTS[sLvl];
  var html = '<h3>🎓 YOUTH ACADEMY — level ' + aLvl + ' / 5</h3>' +
    '<div class="note" style="margin-top:0">Every season the academy graduates ' + (aLvl >= 5 ? 4 : aLvl >= 3 ? 3 : 2) +
    ' young players (age 16–18) straight into your squad. Higher levels produce more graduates with higher ratings and much higher potential.</div>' +
    (aLvl < 5 ? '<span class="btn big' + (save.budget >= aCost ? '' : ' disabled') + '" data-act="upacademy">Upgrade academy to level ' + (aLvl + 1) + ' — ' + fmtM(aCost) + '</span>'
      : '<div class="note">Academy is at maximum level.</div>');
  html += '<h3 style="margin-top:22px">🔍 SCOUTING NETWORK — level ' + sLvl + ' / 5</h3>' +
    '<div class="note" style="margin-top:0">Scouts stock your transfer market: level ' + sLvl + ' finds ' + (6 + sLvl) +
    ' players per matchday. Higher levels discover better and higher-potential players from across the leagues.</div>' +
    (sLvl < 5 ? '<span class="btn big' + (save.budget >= sCost ? '' : ' disabled') + '" data-act="upscout">Upgrade scouting to level ' + (sLvl + 1) + ' — ' + fmtM(sCost) + '</span>'
      : '<div class="note">Scouting network is at maximum level.</div>');
  html += '<h3 style="margin-top:22px">👕 KIT COLOR</h3><div>';
  [[0xe53935, 'RED'], [0x1e88e5, 'BLUE'], [0x2e7d32, 'GREEN'], [0x212121, 'BLACK'], [0xf5f5f5, 'WHITE'], [0x7b1fa2, 'PURPLE']].forEach(function (k) {
    var sel = (save.kitColor || 0xe53935) === k[0];
    html += '<span class="btn big' + (sel ? ' selected' : '') + '" data-act="kit" data-f="' + k[0] + '" style="border-left:14px solid #' + k[0].toString(16).padStart(6, '0') + '">' + k[1] + '</span>';
  });
  html += '</div><div class="note">Applies from the next match.</div>';
  html += '<h3 style="margin-top:22px">✨ CREATE A PLAYER — ' + fmtM(20) + '</h3>';
  if (!builderState) {
    html += '<div>';
    ['GK', 'DF', 'MF', 'FW'].forEach(function (r) {
      html += '<span class="btn big' + (save.budget >= 20 && save.squad.length < 22 ? '' : ' disabled') + '" data-act="createp" data-f="' + r + '">NEW ' + r + '</span>';
    });
    html += '</div><div class="note">Design your own wonderkid: pick the position, then YOU decide every stat. Age 18, high potential, 4-year contract.</div>';
  } else {
    var b = builderState;
    var preview = { role: b.role, pace: b.stats.pace, shoot: b.stats.shoot, pass: b.stats.pass, def: b.stats.def, phys: b.stats.phys };
    var ovrPrev = calcOvr(preview);
    html += '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:14px 18px;max-width:430px">' +
      '<div style="margin-bottom:10px"><b style="color:#ffd54f">NEW ' + b.role + '</b> &nbsp; ' +
      'Name: <input id="cp-name" value="' + (b.name || '') + '" maxlength="14" placeholder="type a name" ' +
      'style="background:#0d1420;border:1px solid #2c3e57;border-radius:6px;color:#fff;padding:5px 10px;font-size:14px;width:150px"></div>' +
      '<div style="color:' + (b.pool > 0 ? '#9ccc65' : '#ef9a9a') + ';font-weight:700;margin-bottom:8px">Points left to spend: ' + b.pool +
      ' &nbsp; <span style="color:#fff">→ OVERALL ' + ovrPrev + '</span></div>';
    [['pace', 'PAC — speed'], ['shoot', 'SHO — shooting'], ['pass', 'PAS — passing'], ['def', 'DEF — defending' + (b.role === 'GK' ? ' / goalkeeping' : '')], ['phys', 'PHY — strength & stamina']].forEach(function (row) {
      var k = row[0], v = b.stats[k];
      html += '<div style="display:flex;align-items:center;gap:10px;padding:3px 0">' +
        '<span class="btn' + (v <= 40 ? ' disabled' : '') + '" data-act="cpdec" data-f="' + k + '">−</span>' +
        '<b style="width:34px;text-align:center;font-size:16px;color:' + (v >= 80 ? '#66bb6a' : '#fff') + '">' + v + '</b>' +
        '<span class="btn' + (b.pool <= 0 || v >= 99 ? ' disabled' : '') + '" data-act="cpinc" data-f="' + k + '">+</span>' +
        '<div style="flex:1;height:7px;background:rgba(255,255,255,.12);border-radius:4px"><div style="width:' + Math.round((v - 30) / 69 * 100) + '%;height:100%;border-radius:4px;background:linear-gradient(90deg,#4dd0e1,#ffd54f)"></div></div>' +
        '<span style="color:#90a4ae;font-size:12px;min-width:150px">' + row[1] + '</span></div>';
    });
    html += '<div style="margin-top:10px;color:#90a4ae;font-size:12px">Choose his PlayStyle:</div><div>';
    b.traitChoices.forEach(function (tr, ti) {
      html += '<span class="btn' + (b.traitSel === ti ? ' selected' : '') + '" data-act="cptrait" data-f="' + ti + '" style="margin:3px">⚡ ' + tr + '</span>';
    });
    html += '</div>';
    html += '<div style="margin-top:12px">' +
      '<span class="btn big buy" data-act="cpconfirm">✔ SIGN HIM — ' + fmtM(20) + '</span>' +
      '<span class="btn big" data-act="cpcancel">Cancel</span></div>' +
      '<div class="note">Potential grows well beyond his starting rating — he is 18, after all.</div></div>';
  }
  html += '<h3 style="margin-top:22px">🏆 TROPHY CABINET</h3>';
  var tr = save.trophies || [];
  if (!tr.length) {
    html += '<div class="note" style="margin-top:0">Empty… for now. Win the league (1st place), the Champions Cup, the Club World Cup, or the World Cup with Meridia to fill it.</div>';
  } else {
    html += '<div style="font-size:14px;line-height:2">';
    tr.forEach(function (t) {
      html += '<div>🏆 <b style="color:#ffd54f">' + t.t + '</b> <span style="color:#78909c">— Season ' + t.s + '</span></div>';
    });
    html += '</div>';
  }
  html += '<h3 style="margin-top:22px">🌍 OTHER COMPETITIONS</h3>' +
    '<div class="note" style="margin-top:0">' +
    '<b>Club World Cup:</b> win your league and after the Champions Cup you face the champions of Azuria, Valdorra and Norland (semi-final + final).<br>' +
    '<b>World Cup:</b> every 4th season you coach the <b>Meridia national team</b> through a knockout tournament of 8 nations (quarter-final → final).</div>';
  html += '<h3 style="margin-top:22px">⭐ CHAMPIONS CUP QUALIFICATION</h3>' +
    '<div class="note" style="margin-top:0">Finish in the <b>top 8 of the Meridian League</b> to qualify for next season\'s Champions Cup, ' +
    'where the best 8 foreign clubs from Azuria, Valdorra and Norland await. ' +
    (save.cup && save.cup.qualified && save.cup.qualified.indexOf(HARDY_DEF.name) >= 0 ?
      '<span style="color:#66bb6a;font-weight:700">Hardy FC are in this season\'s cup.</span>' :
      '<span style="color:#ef5350">Hardy FC are not in this season\'s cup.</span>') + '</div>';
  el.menuBody.innerHTML = html;
}

function buyPlayer(i) {
  var m = save.market[i];
  if (!m || save.budget < m.price || save.squad.length >= 22) return;
  save.budget = Math.round((save.budget - m.price) * 10) / 10;
  m.p.contract = 3;
  save.market.splice(i, 1);
  save.squad.push(m.p);
  assignNumbers(save.squad);
  persist();
  renderMenu();
  showMessage('SIGNED!', m.p.name + ' joins Hardy FC — plays from next match', 2.5);
}
function sellPlayerAt(i) {
  var p = save.squad[i];
  if (!p) return;
  if (save.squad.length <= 13 || (p.role === 'GK' && countRole('GK') <= 1)) return;
  save.budget = Math.round((save.budget + sellPrice(p)) * 10) / 10;
  save.squad.splice(i, 1);
  if (save.lineupIds) save.lineupIds = save.lineupIds.filter(function (id) { return id !== p.id; });
  persist();
  renderMenu();
}
function renewPlayerAt(i) {
  var p = save.squad[i];
  if (!p || save.budget < renewCost(p)) return;
  save.budget = Math.round((save.budget - renewCost(p)) * 10) / 10;
  p.contract += 2;
  persist();
  renderMenu();
}

el.menuPanel.addEventListener('click', function (e) {
  var t = e.target;
  if (t === el.menuPanel) { closeMenu(); return; }
  var act = t.getAttribute && t.getAttribute('data-act');
  if (!act) return;
  if (t.className.indexOf('disabled') >= 0) return;
  var i = parseInt(t.getAttribute('data-i') || '-1', 10);
  if (act === 'buy') buyPlayer(i);
  else if (act === 'sell') sellPlayerAt(i);
  else if (act === 'renew') renewPlayerAt(i);
  else if (act === 'swapsel') {
    var pid = t.getAttribute('data-id');
    if (!swapSel) { swapSel = pid; }
    else if (swapSel === pid) { swapSel = null; }
    else {
      var xiIds = currentXIData().map(function (p) { return p.id; });
      var ai = xiIds.indexOf(swapSel), bi = xiIds.indexOf(pid);
      var live = matchIsLive();
      if (ai >= 0 && bi >= 0) {
        // two starters: swap their POSITIONS
        var ids = xiIds.slice();
        ids[ai] = pid; ids[bi] = swapSel;
        save.lineupIds = ids;
        persist();
        if (live) swapPitchPositions(swapSel, pid);
      } else if (ai >= 0 || bi >= 0) {
        // starter ↔ bench: substitution (live during a match) / lineup change
        var starterIdx = ai >= 0 ? ai : bi;
        var starterId = xiIds[starterIdx];
        var benchId = ai >= 0 ? pid : swapSel;
        var ok = true;
        if (live) ok = makeSubstitution(starterId, benchId);
        if (ok) {
          var ids2 = xiIds.slice();
          ids2[starterIdx] = benchId;
          save.lineupIds = ids2;
          persist();
        }
      }
      swapSel = null;
    }
    renderMenu();
  }
  else if (act === 'autoxi') {
    delete save.lineupIds;
    swapSel = null;
    persist();
    renderMenu();
  }
  else if (act === 'rescout') {
    if (save.budget >= 1) {
      save.budget = Math.round((save.budget - 1) * 10) / 10;
      save.marketMd = -1;
      refreshMarket();
      renderMenu();
    }
  }
  else if (act === 'upacademy') {
    var aCost = ACADEMY_COSTS[save.academyLvl || 1];
    if ((save.academyLvl || 1) < 5 && save.budget >= aCost) {
      save.budget = Math.round((save.budget - aCost) * 10) / 10;
      save.academyLvl = (save.academyLvl || 1) + 1;
      persist();
      renderMenu();
    }
  }
  else if (act === 'upscout') {
    var sCost = SCOUT_COSTS[save.scoutLvl || 1];
    if ((save.scoutLvl || 1) < 5 && save.budget >= sCost) {
      save.budget = Math.round((save.budget - sCost) * 10) / 10;
      save.scoutLvl = (save.scoutLvl || 1) + 1;
      persist();
      renderMenu();
    }
  }
  else if (act === 'kit') {
    save.kitColor = parseInt(t.getAttribute('data-f'), 10);
    persist();
    renderMenu();
  }
  else if (act === 'createp') {
    if (save.budget >= 20 && save.squad.length < 22) {
      var brole = t.getAttribute('data-f');
      builderState = {
        role: brole,
        name: '',
        stats: { pace: 45, shoot: 45, pass: 45, def: 45, phys: 45 },
        pool: 300,
        traitChoices: shuffled(TRAITS_BY_ROLE[brole]).slice(0, 3),
        traitSel: 0
      };
      menuTab = 'club';
      renderMenu();
    }
  }
  else if (act === 'cpinc' || act === 'cpdec') {
    if (builderState) {
      var nmEl = document.getElementById('cp-name');
      if (nmEl) builderState.name = nmEl.value;
      var st = t.getAttribute('data-f');
      if (act === 'cpinc' && builderState.pool > 0 && builderState.stats[st] < 99) {
        var add = Math.min(5, builderState.pool, 99 - builderState.stats[st]);
        builderState.stats[st] += add;
        builderState.pool -= add;
      } else if (act === 'cpdec' && builderState.stats[st] > 40) {
        var sub = Math.min(5, builderState.stats[st] - 40);
        builderState.stats[st] -= sub;
        builderState.pool += sub;
      }
      renderMenu();
    }
  }
  else if (act === 'cptrait') {
    if (builderState) {
      var nmEl3 = document.getElementById('cp-name');
      if (nmEl3) builderState.name = nmEl3.value;
      builderState.traitSel = parseInt(t.getAttribute('data-f'), 10);
      renderMenu();
    }
  }
  else if (act === 'cpcancel') {
    builderState = null;
    renderMenu();
  }
  else if (act === 'cpconfirm') {
    if (builderState && save.budget >= 20 && save.squad.length < 22) {
      var nmEl2 = document.getElementById('cp-name');
      var newName = ((nmEl2 && nmEl2.value) || '').trim() || 'Newman';
      var b2 = builderState;
      var np2 = genPlayer(b2.role, 60, usedNamesFromSquad());
      np2.name = newName.slice(0, 14);
      np2.pace = b2.stats.pace;
      np2.shoot = b2.stats.shoot;
      np2.pass = b2.stats.pass;
      np2.def = b2.stats.def;
      np2.phys = b2.stats.phys;
      np2.ovr = calcOvr(np2);
      np2.age = 18;
      np2.pot = clamp(np2.ovr + irand(12, 20), np2.ovr, 99);
      np2.contract = 4;
      np2.traits = [b2.traitChoices[b2.traitSel || 0]];
      np2.value = playerValue(np2.ovr);
      save.budget = Math.round((save.budget - 20) * 10) / 10;
      save.squad.push(np2);
      assignNumbers(save.squad);
      builderState = null;
      persist();
      renderMenu();
      showMessage('✨ SIGNED!', np2.name + ' (' + b2.role + ', ' + np2.ovr + ' OVR, potential ' + np2.pot + ') — your creation joins the squad', 3.5);
    }
  }
  else if (act === 'difficulty') {
    save.difficulty = parseInt(t.getAttribute('data-f'), 10);
    persist();
    renderMenu();
  }
  else if (act === 'formation') {
    save.formation = t.getAttribute('data-f');
    if (home) reassignSlots(home, save.formation);
    persist();
    renderMenu();
  } else if (act === 'mentality') {
    save.mentality = t.getAttribute('data-f');
    if (home) home.mentality = save.mentality;
    persist();
    renderMenu();
  }
});
el.menuTabs.addEventListener('click', function (e) {
  var tab = e.target.getAttribute && e.target.getAttribute('data-tab');
  if (tab) { menuTab = tab; renderMenu(); }
});
el.menuClose.addEventListener('click', closeMenu);
el.menuButton.addEventListener('click', function () { if (menuOpen) closeMenu(); else openMenu(); });

// ---------- Match simulation ----------
var simRunning = false;
function avgOvr(team) {
  var s = 0;
  team.players.forEach(function (p) { s += p.data.ovr; });
  return team.players.length ? s / team.players.length : 70;
}
function simGoalsFor(att, def, remainFrac) {
  var exp = remainFrac * 1.45 * Math.pow(att / def, 3);
  var g = 0, pr = clamp(exp * 0.55, 0.04, 0.9);
  while (Math.random() < pr && g < 6) { g++; pr *= 0.5; }
  return g;
}
function simulateRestOfMatch() {
  if (simRunning || menuOpen) return;
  if (match.state !== 'play' && match.state !== 'freeze' && match.state !== 'halftime') return;
  simRunning = true;
  var wasPaused = match.paused;
  match.paused = true;
  el.simOverlay.style.display = 'flex';
  el.simFill.style.width = '0%';
  var prog = 0;
  var iv = setInterval(function () {
    prog += 3.5;
    el.simFill.style.width = Math.min(100, prog) + '%';
    if (prog >= 100) {
      clearInterval(iv);
      el.simOverlay.style.display = 'none';
      match.paused = false;
      pendingRestart = null;
      pendingSendOff = null;
      var played = (match.half - 1) * 45 + clamp(match.clock / HALF_REAL_SECONDS, 0, 1) * 45;
      var remainFrac = clamp((90 - played) / 90, 0, 1);
      var h = avgOvr(home), a = avgOvr(away);
      home.score += simGoalsFor(h, a, remainFrac) + (remainFrac > 0.2 ? 0 : 0);
      away.score += simGoalsFor(a, h, remainFrac);
      el.scoreHome.textContent = home.score;
      el.scoreAway.textContent = away.score;
      simRunning = false;
      finishMatch();
    }
  }, 40);
}
el.simButton.addEventListener('click', function () {
  if (trainingMode) { location.reload(); return; }
  startAudio(); hideStartOverlay(); simulateRestOfMatch();
});

// ---------- Match state ----------
var match = {
  state: 'freeze',
  freezeTimer: 1.2,
  afterFreeze: 'play',
  half: 1,
  clock: 0,
  paused: false,
  recorded: false,
  subsUsed: 0,
  stoppages: 0,
  injReal: 0,
  injSet: false,
  celebrate: null,
  stats: null
};
function freshStats() {
  return {
    h: { shots: 0, onT: 0, fouls: 0, corners: 0, passes: 0, poss: 0 },
    a: { shots: 0, onT: 0, fouls: 0, corners: 0, passes: 0, poss: 0 }
  };
}
match.stats = freshStats();
function statsFor(team) { return team === home ? match.stats.h : match.stats.a; }
function renderStatsPanel(title) {
  var s = match.stats, h = s.h, a = s.a;
  var tot = h.poss + a.poss || 1;
  var rows = [
    ['POSSESSION', Math.round(h.poss / tot * 100) + '%', Math.round(a.poss / tot * 100) + '%'],
    ['SHOTS', h.shots, a.shots],
    ['ON TARGET', h.onT, a.onT],
    ['PASSES', h.passes, a.passes],
    ['FOULS', h.fouls, a.fouls],
    ['CORNERS', h.corners, a.corners],
    ['EXPECTED GOALS (xG)', (h.xg || 0).toFixed(2), (a.xg || 0).toFixed(2)]
  ];
  var html = '<h3>' + title + ' — ' + home.short + ' ' + home.score + ' – ' + away.score + ' ' + away.short + '</h3>';
  rows.forEach(function (r) {
    html += '<div class="row"><b>' + r[1] + '</b><span class="lab">' + r[0] + '</span><b>' + r[2] + '</b></div>';
  });
  // Player of the Match
  if (teams.length) {
    var potm = null;
    allPlayers().forEach(function (p) {
      if (!potm || (p.matchRating || 6) > (potm.matchRating || 6)) potm = p;
    });
    if (potm) {
      html += '<div style="text-align:center;margin-top:10px;color:#ffd54f;font-weight:700;font-size:13px">⭐ Player of the Match: ' +
        potm.name + ' (' + potm.team.short + ') — ' + (potm.matchRating || 6).toFixed(1) + '</div>';
    }
  }
  el.statsPanel.innerHTML = html;
  el.statsPanel.style.display = 'block';
}
function hideStatsPanel() { el.statsPanel.style.display = 'none'; }
var pendingRestart = null;
var pendingSendOff = null;

function displayClock() {
  var base = match.half === 1 ? 0 : 45;
  if (match.clock > HALF_REAL_SECONDS) {
    var overMin = Math.max(1, Math.ceil((match.clock - HALF_REAL_SECONDS) / (HALF_REAL_SECONDS / 45)));
    return (base + 45) + "+" + overMin + "'";
  }
  var frac = clamp(match.clock / HALF_REAL_SECONDS, 0, 1);
  var mins = base + frac * 45;
  var m = Math.floor(mins), s = Math.floor((mins - m) * 60);
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function resetToFormation(kickoffTeam) {
  teams.forEach(function (t) {
    t.players.forEach(function (p) {
      var fp = t.formationPoint(p, new THREE.Vector3(0, 0, 0));
      if (fp.x * t.attackDir > -1) fp.x = -t.attackDir * Math.max(2.5, Math.abs(fp.x) * 0.4);
      if (p.role === 'GK') fp.x = -t.attackDir * (HALF_L - 1.2);
      p.pos.copy(fp);
      p.vel.set(0, 0, 0);
      p.throwIn = false;
      p.holdBall = 0;
      p.setPiece = null;
      setPieceAim = null;
      aimLine.visible = false;
    });
  });
  ball.pos.set(0, BALL_R, 0);
  ball.vel.set(0, 0, 0);
  ball.carrier = null;
  ball.kickCooldown = 0;
  ball.restartProtect = 0;
  var striker = null;
  kickoffTeam.players.forEach(function (p) { if (p.role === 'FW') striker = p; });
  if (!striker) striker = kickoffTeam.players[kickoffTeam.players.length - 1];
  striker.pos.set(-kickoffTeam.attackDir * 1.5, 0, 0.5);
  ball.lastTouchTeam = kickoffTeam;
}

function beginFreeze(seconds, after, mainHTML, sub) {
  match.state = 'freeze';
  match.freezeTimer = seconds;
  match.afterFreeze = after;
  if (mainHTML) showMessage(mainHTML, sub, seconds);
}

// ---------- Goals ----------
function scoreGoal(scoringTeam, scorer) {
  if (trainingMode) {
    showMessage('GOAL!', 'lovely finish — again!', 2);
    exciteCrowd(0.6);
    ball.carrier = null;
    ball.pos.set(-8, BALL_R, rand(-8, 8));
    ball.vel.set(0, 0, 0);
    return;
  }
  scoringTeam.score++;
  el.scoreHome.textContent = home.score;
  el.scoreAway.textContent = away.score;
  exciteCrowd(scoringTeam.isUser ? 1.0 : 0.75);
  whistle(1);
  statsFor(scoringTeam).onT++;
  match.stoppages++;
  if (scorer) {
    match.scorerCounts = match.scorerCounts || {};
    match.scorerCounts[scorer.name] = (match.scorerCounts[scorer.name] || 0) + 1;
    scorer.matchRating = clamp((scorer.matchRating || 6) + 1.0, 4, 10);
    // assist: the previous teammate to touch it
    if (ball.prevKicker && ball.prevKicker !== scorer && ball.prevKicker.team === scoringTeam) {
      ball.prevKicker.matchRating = clamp((ball.prevKicker.matchRating || 6) + 0.6, 4, 10);
    }
    var cz = scorer.pos.z >= 0 ? HALF_W - 4 : -HALF_W + 4;
    match.celebrate = {
      p: scorer, t: 2.6, tx: scoringTeam.attackDir * (HALF_L - 5), tz: cz,
      style: Math.random() < 0.5 ? 'knee' : 'run', waitReplay: true
    };
  }
  startReplay();
  sayGoal(scorer ? scorer.name : null, scoringTeam.name, scoringTeam);
  var scorerTxt = scorer ? scorer.name + ' scores for ' + scoringTeam.name + '!' : scoringTeam.name + ' score!';
  beginFreeze(5.4, 'kickoff-' + (scoringTeam === home ? 'away' : 'home'), 'GOAL!', scorerTxt);
}

// ---------- Restarts ----------
function nearestPlayer(team, point, excludeGK) {
  var best = null, bd = 1e9;
  team.players.forEach(function (p) {
    if (excludeGK && p.role === 'GK') return;
    var d = dist2d(p.pos.x, p.pos.z, point.x, point.z);
    if (d < bd) { bd = d; best = p; }
  });
  return best;
}

function pushOpponentsAway(possTeam, spot, minDist) {
  otherTeam(possTeam).players.forEach(function (p) {
    if (p.role === 'GK') return;
    var d = dist2d(p.pos.x, p.pos.z, spot.x, spot.z);
    if (d < minDist) {
      var dx = p.pos.x - spot.x, dz = p.pos.z - spot.z;
      if (d < 0.01) { dx = -possTeam.attackDir; dz = rand(-1, 1); d = 1; }
      p.pos.x = clamp(spot.x + (dx / d) * minDist, -HALF_L + 1, HALF_L - 1);
      p.pos.z = clamp(spot.z + (dz / d) * minDist, -HALF_W + 1, HALF_W - 1);
      p.vel.set(0, 0, 0);
    }
  });
}

function executeRestart(r) {
  ball.pos.set(r.spot.x, BALL_R, r.spot.z);
  ball.vel.set(0, 0, 0);
  ball.carrier = null;
  ball.kickCooldown = 0;
  ball.lastTouchTeam = r.team;
  ball.restartProtect = 2.2;

  if (pendingSendOff) { sendOff(pendingSendOff); pendingSendOff = null; }

  var taker;
  if (r.type === 'goalkick') {
    taker = r.team.keeper();
    taker.pos.set(r.spot.x - r.team.attackDir * 0.9, 0, r.spot.z);
    taker.holdBall = 1.2;
    pushOpponentsAway(r.team, r.spot, 14);
  } else if (r.type === 'throwin') {
    taker = nearestPlayer(r.team, r.spot, true);
    taker.pos.set(r.spot.x, 0, Math.sign(r.spot.z) * (HALF_W + 0.9));
    taker.facing.set(0, 0, -Math.sign(r.spot.z));
    taker.throwIn = true;
    taker.throwTimer = r.team.isUser ? 9999 : 1.2;
    ball.carrier = taker;
    pushOpponentsAway(r.team, taker.pos, 4.5);
  } else if (r.type === 'penalty') {
    var sign = Math.sign(r.spot.x);
    allPlayers().forEach(function (p) {
      var inBox = Math.abs(p.pos.z) < BOX_W + 1 && p.pos.x * sign > HALF_L - BOX_D - 1;
      if (inBox && p.role !== 'GK') {
        p.pos.set(sign * (HALF_L - BOX_D - rand(2, 6)), 0, rand(-14, 14));
        p.vel.set(0, 0, 0);
      }
    });
    var gk = otherTeam(r.team).keeper();
    gk.pos.set(sign * (HALF_L - 0.5), 0, 0);
    gk.vel.set(0, 0, 0);
    taker = nearestPlayer(r.team, r.spot, true);
    taker.pos.set(r.spot.x - r.team.attackDir * 1.4, 0, r.spot.z);
    taker.vel.set(0, 0, 0);
    ball.carrier = taker;
    if (r.team.isUser) setPieceAim = { taker: taker, spot: r.spot.clone() };
  } else {
    taker = nearestPlayer(r.team, r.spot, true);
    taker.pos.set(r.spot.x - r.team.attackDir * 0.9, 0, r.spot.z);
    taker.vel.set(0, 0, 0);
    ball.carrier = taker;
    pushOpponentsAway(r.team, r.spot, r.type === 'corner' ? 6 : 9.15);
    if (!r.team.isUser) taker.setPiece = { t: 1.1, type: r.type };
    else if (r.type === 'freekick') setPieceAim = { taker: taker, spot: r.spot.clone() };
  }
  if (taker) ball.lastKicker = taker;
  beginFreeze(1.0, 'play', r.label, r.sub);
  whistle(1);
}

function queueRestart(team, spot, label, sub, type, freezeSecs, mainNow, subNow) {
  pendingRestart = { team: team, spot: spot, label: label, sub: sub, type: type };
  beginFreeze(freezeSecs || 0.9, 'do-restart', mainNow || label, subNow || sub);
}

function handleBallOut() {
  if (trainingMode) {
    ball.carrier = null;
    ball.pos.set(-8, BALL_R, rand(-8, 8));
    ball.vel.set(0, 0, 0);
    return;
  }
  var bx = ball.pos.x, bz = ball.pos.z;
  if (Math.abs(bx) > HALF_L) {
    var defTeam = teams.filter(function (t) { return t.attackDir * Math.sign(bx) < 0; })[0];
    var atkTeam = otherTeam(defTeam);
    if (ball.lastTouchTeam === defTeam) {
      var cz = bz > 0 ? HALF_W - 0.5 : -HALF_W + 0.5;
      statsFor(atkTeam).corners++;
      queueRestart(atkTeam, new THREE.Vector3(Math.sign(bx) * (HALF_L - 0.5), 0, cz),
        'CORNER', atkTeam.name, 'corner');
    } else {
      if (ball.wasShot && ball.lastKicker) {
        if (ball.lastKicker.team === home) {
          var mparts = [{ t: pickT(['Ohh, just wide! So close!', 'He drags it wide... agonising.', 'Inches away! He cannot believe it.']), e: 'sad' }];
          var mcol = colorPart('miss');
          if (mcol) mparts.push(mcol);
          sayParts(mparts, 2);
        } else {
          say(pickT(['Wide! A let-off there.', 'Off target — they survive.', 'He should have hit the target from there.']), 2, 'build');
        }
        ball.wasShot = false;
      }
      queueRestart(defTeam, new THREE.Vector3(Math.sign(bx) * (HALF_L - 5.5), 0, 0),
        'GOAL KICK', defTeam.name, 'goalkick');
    }
    return;
  }
  if (Math.abs(bz) > HALF_W) {
    var throwTeam = otherTeam(ball.lastTouchTeam || home);
    queueRestart(throwTeam,
      new THREE.Vector3(clamp(bx, -HALF_L + 1, HALF_L - 1), 0, Math.sign(bz) * (HALF_W - 0.2)),
      'THROW-IN', throwTeam.name + (throwTeam.isUser ? ' — press SPACE to throw' : ''), 'throwin');
  }
}

// ---------- Fouls & cards ----------
function sendOff(player) {
  player.sentOff = true;
  scene.remove(player.mesh);
  var arr = player.team.players;
  var idx = arr.indexOf(player);
  if (idx >= 0) arr.splice(idx, 1);
  if (ball.carrier === player) ball.carrier = null;
  if (controlledPlayer === player) { controlledPlayer = null; pickControlledPlayer(); }
}

function callFoul(offender, spot, typeLabel, severity) {
  if (match.state !== 'play' || trainingMode) return;
  var fouledTeam = otherTeam(offender.team);
  // advantage rule: if the fouled team still has the ball, sometimes play on
  if (typeLabel === 'FOUL!' && ball.carrier && ball.carrier.team === fouledTeam && Math.random() < 0.3) {
    showMessage('ADVANTAGE', 'play on!', 1.2);
    exciteCrowd(0.2);
    return;
  }
  statsFor(offender.team).fouls++;
  offender.matchRating = clamp((offender.matchRating || 6) - 0.2, 4, 10);
  match.stoppages++;
  whistle(2);
  exciteCrowd(0.45);

  var card = null;
  var r = Math.random();
  if (severity === 'behind') {
    // sliding through the back of a player: straight red, no debate
    card = 'red';
  } else {
    var yellowChance = typeLabel === 'HANDBALL!' ? 0.25 : (severity === 'late' ? 0.6 : 0.4);
    if (r < 0.05 && offender.role !== 'GK') card = 'red';
    else if (r < yellowChance && offender.role !== 'GK') card = 'yellow';
  }
  if (card === 'yellow') {
    offender.yellows++;
    if (offender.yellows >= 2) card = 'red';
  }

  var sub, main;
  if (card === 'red') {
    main = cardChip('#e53935') + ' RED CARD';
    sub = offender.name + ' (' + offender.team.name + ') is sent off!' + (severity === 'behind' ? ' A horror challenge from behind!' : '');
    pendingSendOff = offender;
    cardMesh.material.color.set(0xe53935);
    referee.cardTimer = 2.4;
    exciteCrowd(0.8);
    sayFoul(offender.name, 'red', severity === 'behind');
  } else if (card === 'yellow') {
    main = cardChip('#fdd835') + ' YELLOW CARD';
    sub = offender.name + ' (' + offender.team.name + ') goes in the book';
    cardMesh.material.color.set(0xfdd835);
    referee.cardTimer = 2.2;
    sayFoul(offender.name, 'yellow');
  } else {
    main = typeLabel;
    sub = 'Free kick to ' + fouledTeam.name;
    sayFoul(offender.name, null);
  }

  var ownGoalSign = Math.sign(-offender.team.attackDir);
  var inOwnBox = Math.abs(spot.z) < BOX_W && spot.x * ownGoalSign > HALF_L - BOX_D;
  if (inOwnBox) {
    pendingRestart = {
      team: fouledTeam,
      spot: new THREE.Vector3(ownGoalSign * (HALF_L - 11), 0, 0),
      label: 'PENALTY!',
      sub: fouledTeam.name + (fouledTeam.isUser ? ' — hold K for power, release to shoot!' : ''),
      type: 'penalty'
    };
    var pparts = [
      { t: 'Penalty! Penalty to ' + fouledTeam.name + '!', e: 'excited' },
      { t: 'A huge moment in this match...', e: 'tense' }
    ];
    var pcol = colorPart('penalty');
    if (pcol) pparts.push(pcol);
    sayParts(pparts, 3);
  } else {
    pendingRestart = {
      team: fouledTeam,
      spot: new THREE.Vector3(clamp(spot.x, -HALF_L + 2, HALF_L - 2), 0, clamp(spot.z, -HALF_W + 2, HALF_W - 2)),
      label: 'FREE KICK',
      sub: fouledTeam.name + (fouledTeam.isUser ? ' — aim with WASD, hold K for power' : ''),
      type: 'freekick'
    };
  }
  beginFreeze(card ? 2.6 : 1.6, 'do-restart', main, sub);
  ball.carrier = null;
  ball.vel.multiplyScalar(0.2);
}

function attemptTackle(tackler, carrier, dt, instant, isSlide) {
  var q = Math.pow(tackler.defSkill / 70, 1.4);   // defending rating strongly drives clean steals
  var stealP = (instant ? (isSlide ? 0.72 : 0.6) : 2.0 * dt) * q;
  var foulP = (instant ? (isSlide ? 0.32 : 0.18) : 0.55 * dt) * (2 - q);
  if (!isSlide && hasTrait(tackler, 'Anchor')) stealP *= 1.25;
  if (isSlide && hasTrait(tackler, 'Slide Master')) { stealP *= 1.15; foulP *= 0.5; }
  if (hasTrait(carrier, 'Bruiser')) stealP *= 0.72;
  // where did the challenge come from? through the back = dangerous play
  var tv = new THREE.Vector3(tackler.pos.x - carrier.pos.x, 0, tackler.pos.z - carrier.pos.z).normalize();
  var fromBehind = (tv.x * carrier.facing.x + tv.z * carrier.facing.z) < -0.35;
  var severity = null;
  if (isSlide && fromBehind) {
    // sliding through the back of a player: automatic foul, straight red
    setAnim(carrier, 'fall', 1.1);
    callFoul(tackler, carrier.pos.clone(), 'FOUL!', 'behind');
    return true;
  } else if (fromBehind) {
    foulP *= 1.6;
    severity = 'late';
  }
  var r = Math.random();
  if (r < stealP) {
    ball.carrier = tackler;
    ball.lastTouchTeam = tackler.team;
    ball.lastKicker = tackler;
    ball.vel.multiplyScalar(0.3);
    carrier.vel.multiplyScalar(0.4);
    setAnim(carrier, 'stumble', 0.5, Math.random() < 0.5 ? 1 : -1);
    tackler.matchRating = clamp((tackler.matchRating || 6) + 0.15, 4, 10);
    if (Math.random() < 0.4) sayTackle(tackler.name, !!isSlide);
    return true;
  }
  if (r < stealP + foulP) {
    setAnim(carrier, 'fall', 1.1);
    callFoul(tackler, carrier.pos.clone(), 'FOUL!', severity);
    return true;
  }
  if (instant) tackler.vel.multiplyScalar(0.3);
  return false;
}

// ---------- Ball physics ----------
function updateBall(dt) {
  ball.kickCooldown = Math.max(0, ball.kickCooldown - dt);
  ball.restartProtect = Math.max(0, ball.restartProtect - dt);
  ball.inPlayGrace = Math.max(0, ball.inPlayGrace - dt);

  if (ball.carrier && ball.carrier.throwIn) {
    var t = ball.carrier;
    ball.pos.set(t.pos.x + t.facing.x * 0.18, 1.95, t.pos.z + t.facing.z * 0.18);
    ball.vel.set(0, 0, 0);
    ballMesh.position.copy(ball.pos);
    return;
  }

  if (ball.carrier) {
    var c = ball.carrier;
    var speed = c.vel.length();
    var ahead = 0.55 + speed * 0.16;
    var target = new THREE.Vector3(c.pos.x + c.facing.x * ahead, BALL_R, c.pos.z + c.facing.z * ahead);
    var k = (speed > 5.5 ? 9 : 16) * (0.55 + c.skill * 0.6);   // low control = heavy, loose touches
    ball.vel.x += (target.x - ball.pos.x) * k * dt * 4;
    ball.vel.z += (target.z - ball.pos.z) * k * dt * 4;
    ball.vel.x *= 0.86; ball.vel.z *= 0.86;
    if (dist2d(ball.pos.x, ball.pos.z, c.pos.x, c.pos.z) > 2.1) ball.carrier = null;
  }

  ball.vel.y += GRAVITY * dt;
  // surface: wet = skiddy, short grass = quick, long grass = grabby
  var groundDrag = weather.rain ? 0.4 : 0.55;
  if (weather.grass === 'short') groundDrag *= 0.8;
  else if (weather.grass === 'long') groundDrag *= 1.35;
  var drag = ball.pos.y > BALL_R + 0.02 ? 0.15 : groundDrag;
  ball.vel.x -= ball.vel.x * drag * dt;
  ball.vel.z -= ball.vel.z * drag * dt;
  ball.pos.addScaledVector(ball.vel, dt);

  if (ball.pos.y < BALL_R) {
    ball.pos.y = BALL_R;
    var rest = weather.rain ? 0.42 : 0.55;
    if (ball.vel.y < -0.8) { ball.vel.y = -ball.vel.y * rest; kickSound(2); }
    else ball.vel.y = 0;
  }

  if (!ball.carrier) {
    var sp0 = Math.sqrt(ball.vel.x * ball.vel.x + ball.vel.z * ball.vel.z);
    if (sp0 > 6) {
      var ps = allPlayers();
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        if (p === ball.lastKicker && ball.kickCooldown > 0) continue;
        var d = dist2d(p.pos.x, p.pos.z, ball.pos.x, ball.pos.z);
        if (d < 0.38 && ball.pos.y < 1.85) {
          var nx = (ball.pos.x - p.pos.x) / (d || 0.01), nz = (ball.pos.z - p.pos.z) / (d || 0.01);
          var dot = ball.vel.x * nx + ball.vel.z * nz;
          if (dot < 0) {
            if (ball.pos.y > 1.45) {
              // HEADER: nod it on toward the attacking direction
              setAnim(p, 'header', 0.5);
              var gdir = p.team.attackDir;
              var hdPow = hasTrait(p, 'Aerial') ? 1.35 : 1;
              ball.vel.x = gdir * (Math.abs(ball.vel.x) * 0.45 + 5) * hdPow;
              ball.vel.z = ball.vel.z * 0.3 + rand(-3.5, 3.5);
              ball.vel.y = 2 + rand(0, 2.2);
              exciteCrowd(0.2);
            } else {
              ball.vel.x -= 1.7 * dot * nx;
              ball.vel.z -= 1.7 * dot * nz;
              ball.vel.multiplyScalar(0.42);
            }
            kickSound(6);
            var armHeight = ball.pos.y > 0.85 && ball.pos.y <= 1.45;
            ball.lastTouchTeam = p.team;
            ball.lastKicker = p;
            ball.kickCooldown = 0.3;
            ball.offside = null;                // a touch resets the offside flag
            if (armHeight && p.role !== 'GK' && match.state === 'play' &&
                ball.restartProtect <= 0 && Math.random() < 0.35) {
              callFoul(p, p.pos.clone(), 'HANDBALL!');
            }
            break;
          }
        }
      }
    }
  }

  [-HALF_L, HALF_L].forEach(function (gx) {
    [-GOAL_W / 2, GOAL_W / 2].forEach(function (pz) {
      var dx = ball.pos.x - gx, dz = ball.pos.z - pz;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < BALL_R + POST_R && ball.pos.y < GOAL_H + 0.1 && d > 0.0001) {
        var nx = dx / d, nz = dz / d;
        var dot = ball.vel.x * nx + ball.vel.z * nz;
        if (dot < 0) {
          ball.vel.x -= 2 * dot * nx; ball.vel.z -= 2 * dot * nz;
          ball.vel.multiplyScalar(0.7);
          kickSound(10);
          exciteCrowd(0.45);
          commentate('post');
        }
      }
    });
    if (Math.abs(ball.pos.x - gx) < BALL_R + POST_R && Math.abs(ball.pos.z) < GOAL_W / 2) {
      var dy = ball.pos.y - GOAL_H;
      if (Math.abs(dy) < BALL_R + POST_R && Math.abs(ball.vel.x) > 0.5) {
        ball.vel.x = -ball.vel.x * 0.6;
        ball.vel.y = dy > 0 ? Math.abs(ball.vel.y) * 0.5 : -Math.abs(ball.vel.y) * 0.5 - 1;
        kickSound(10);
        exciteCrowd(0.5);
      }
    }
  });

  if (match.state === 'play' && Math.abs(ball.pos.x) > HALF_L + BALL_R &&
      Math.abs(ball.pos.z) < GOAL_W / 2 - 0.05 && ball.pos.y < GOAL_H) {
    var scoring = teams.filter(function (t) { return t.attackDir === Math.sign(ball.pos.x); })[0];
    var scorer = (ball.lastKicker && ball.lastKicker.team === scoring) ? ball.lastKicker : null;
    scoreGoal(scoring, scorer);
    return;
  }

  if (Math.abs(ball.pos.x) > HALF_L + 1.8) {
    ball.pos.x = Math.sign(ball.pos.x) * (HALF_L + 1.8);
    ball.vel.x *= -0.3;
  }

  if (match.state === 'play' && ball.inPlayGrace <= 0 &&
      (Math.abs(ball.pos.x) > HALF_L + BALL_R || Math.abs(ball.pos.z) > HALF_W + BALL_R)) {
    handleBallOut();
  }

  ballMesh.position.copy(ball.pos);
  var sp = Math.sqrt(ball.vel.x * ball.vel.x + ball.vel.z * ball.vel.z);
  if (sp > 0.05) {
    var axis = new THREE.Vector3(ball.vel.z, 0, -ball.vel.x).normalize();
    ballMesh.rotateOnWorldAxis(axis, -sp * dt / BALL_R);
  }
}

function updatePossession() {
  if (ball.carrier || ball.pos.y > 0.9) return;
  var speed = ball.vel.length();
  if (speed > 11) return;
  var best = null, bd = 1e9;
  allPlayers().forEach(function (p) {
    if (p === ball.lastKicker && ball.kickCooldown > 0) return;
    var d = dist2d(p.pos.x, p.pos.z, ball.pos.x, ball.pos.z);
    var reach = hasTrait(p, 'Interceptor') ? 1.6 : 1.25;
    if (d < reach && d < bd) { bd = d; best = p; }
  });
  if (best) {
    if (speed > 6 && Math.random() > best.skill) {
      ball.vel.multiplyScalar(0.45);
      return;
    }
    // offside: flagged at the moment of the pass, now first to the ball
    if (match.state === 'play' && ball.offside && ball.offside.team === best.team &&
        ball.offside.players.indexOf(best) >= 0) {
      ball.offside = null;
      match.stoppages++;
      sayOffside(best.name);
      var defT = otherTeam(best.team);
      queueRestart(defT,
        new THREE.Vector3(clamp(best.pos.x, -HALF_L + 2, HALF_L - 2), 0, clamp(best.pos.z, -HALF_W + 2, HALF_W - 2)),
        '🚩 OFFSIDE', 'Free kick to ' + defT.name, 'freekick');
      return;
    }
    if (ball.offside && best.team !== ball.offside.team) ball.offside = null;
    ball.carrier = best;
    ball.lastTouchTeam = best.team;
    ball.lastKicker = best;          // scorer credit follows the ball carrier
    if (best.role === 'GK' && speed > 2) {
      ball.vel.set(0, 0, 0);
      best.holdBall = 1.1;
    }
  }
}

// ---------- Kicking ----------
function kickBall(player, dir, power, lift, errSkill) {
  if (setPieceAim && player === setPieceAim.taker) { setPieceAim = null; aimLine.visible = false; }
  var wasThrow = player.throwIn;
  player.throwIn = false;
  ball.carrier = null;
  ball.prevKicker = ball.lastKicker;      // for assist credit
  ball.lastKicker = player;
  ball.lastTouchTeam = player.team;
  ball.kickCooldown = 0.45;
  var d = dir.clone().normalize();
  var effSkill = errSkill || player.skill;
  if (ball.restartProtect > 0 && hasTrait(player, 'Set-Piece Spec')) effSkill = 0.98;
  var err = (1 - effSkill) * 0.22;   // low-rated players genuinely spray it
  var ang = rand(-err, err);
  var cos = Math.cos(ang), sin = Math.sin(ang);
  var dx = d.x * cos - d.z * sin, dz = d.x * sin + d.z * cos;
  ball.wasShot = false;
  setAnim(player, wasThrow ? 'throw' : 'kick', wasThrow ? 0.3 : 0.34);
  if (wasThrow) power *= 0.7;
  // weather & grass shape the kick itself
  if (lift < 2) {
    if (weather.rain) power *= 1.15;                 // low balls fly off a wet pitch
    if (weather.grass === 'long') power *= 0.93;     // long grass holds them up
    if (weather.grass === 'short') power *= 1.05;
  }
  // a restart kick starts on/behind the line — give it time to come into play
  if (wasThrow || ball.restartProtect > 0) ball.inPlayGrace = 0.8;
  // offside snapshot: teammates beyond ball AND the second-last defender at the kick
  if (!wasThrow && ball.restartProtect <= 0 && teams.length && match.state === 'play' && !trainingMode) {
    var kt = player.team, oppT = otherTeam(kt);
    var lines = oppT.players.map(function (o) { return o.pos.x * kt.attackDir; }).sort(function (a, b) { return b - a; });
    var secondLast = lines.length > 1 ? lines[1] : 0;
    var ballLine = ball.pos.x * kt.attackDir;
    var flagged = [];
    kt.players.forEach(function (m) {
      if (m === player || m.role === 'GK') return;
      var mx = m.pos.x * kt.attackDir;
      if (mx > 0.5 && mx > secondLast + 0.15 && mx > ballLine) flagged.push(m);
    });
    ball.offside = flagged.length ? { team: kt, players: flagged } : null;
  } else {
    ball.offside = null;
  }
  ball.vel.set(dx * power, lift, dz * power);
  kickSound(power);
}

function doPass(player, desiredDir, through) {
  var mates = player.team.players.filter(function (p) { return p !== player && p.role !== 'GK'; });
  var dir = desiredDir.lengthSq() > 0 ? desiredDir : new THREE.Vector3(player.team.attackDir, 0, 0);
  if (player.throwIn) {
    dir = new THREE.Vector3(dir.x, 0, -Math.sign(player.pos.z) * Math.max(0.4, Math.abs(dir.z) || 0.6));
    dir.normalize();
  }
  var best = null, bestScore = -1e9;
  var opps = otherTeam(player.team).players;
  var vision = player.style === 'Playmaker' ? 55 : 45;      // playmakers see farther
  mates.forEach(function (m) {
    var to = new THREE.Vector3(m.pos.x - player.pos.x, 0, m.pos.z - player.pos.z);
    var d = to.length();
    if (d < 2 || d > vision) return;
    to.normalize();
    var align = to.dot(dir);
    if (align < 0.1) return;
    var open = 1e9;
    opps.forEach(function (o) { open = Math.min(open, dist2d(o.pos.x, o.pos.z, m.pos.x, m.pos.z)); });
    var forward = (m.pos.x - player.pos.x) * player.team.attackDir;
    var runBonus = (m.style === 'Poacher' || m.style === 'Winger') && through ? 6 : 0;
    var score = align * 40 + Math.min(open, 12) * 2 + (through ? forward * 1.6 : forward * 0.4) - d * 0.35 + runBonus;
    if (score > bestScore) { bestScore = score; best = m; }
  });
  if (!best) {
    kickBall(player, dir, 12, 1, player.passSkill);
    return;
  }
  if (Math.random() < 0.1 && match.state === 'play' && !trainingMode) sayPass(player.name, best.name);
  var target = best.pos.clone();
  if (through) {
    target.x += player.team.attackDir * 9;
    target.z += (best.vel.z || 0) * 0.6;
    target.x = clamp(target.x, -HALF_L + 2, HALF_L - 2);
  } else {
    target.addScaledVector(best.vel, 0.35);
  }
  var to = new THREE.Vector3(target.x - player.pos.x, 0, target.z - player.pos.z);
  var d = to.length();
  var power = clamp(7 + d * 0.55, 8, 24);
  var lift = d > 26 ? 4.2 : d > 15 ? 1.6 : 0.4;
  var hmP = heightMod(player);
  if (hmP === 'low') { lift = 0.2; power *= 1.08; }
  else if (hmP === 'high') { lift = Math.max(lift, 4.5); }
  var passSk = player.passSkill;
  if (d < 18 && hasTrait(player, 'Tiki-Taka')) passSk = 0.98;
  if ((d >= 18 || through) && hasTrait(player, 'Long Ball')) { power *= 1.08; passSk = clamp(passSk + 0.15, 0, 1); }
  if (teams.length && match.state === 'play') {
    statsFor(player.team).passes++;
    player.matchRating = clamp((player.matchRating || 6) + 0.02, 4, 10);
  }
  kickBall(player, to, power, lift, passSk);
}

// hold 1 while kicking = keep it LOW and driven · hold 2 = LOFT it
function heightMod(player) {
  if (player !== controlledPlayer) return null;
  if (keys['Digit1'] || keys['Numpad1']) return 'low';
  if (keys['Digit2'] || keys['Numpad2']) return 'high';
  return null;
}
function doShot(player, aimDir, charge) {
  if (charge === undefined) charge = 0.5 + rand(-0.1, 0.15);   // AI shot power varies
  var goalX = player.team.attackDir * HALF_L;
  // full-power rockets are harder to place accurately
  var aimZ = clamp((aimDir.lengthSq() > 0 ? aimDir.z : 0) * 3.2 + rand(-1, 1) * (1.15 - player.shootSkill) * (1 + charge * 0.7),
    -GOAL_W / 2 + 0.4, GOAL_W / 2 - 0.4);
  var to = new THREE.Vector3(goalX - player.pos.x, 0, aimZ - player.pos.z);
  var d = to.length();
  var power = clamp((15 + d * 0.35 + player.data.shoot * 0.04) * (0.72 + 0.55 * charge), 12, 33);
  var lift = clamp(2.0 + d * 0.09 + charge * 1.6 + rand(-0.8, 1.0), 1.0, 7.0);
  var hm = heightMod(player);
  if (hm === 'low') { lift = clamp(lift * 0.3, 0.5, 1.5); power *= 1.12; }
  else if (hm === 'high') { lift = clamp(lift * 1.9, 4.2, 8.5); power *= 0.85; }
  var errSk = player.shootSkill;
  if (hasTrait(player, 'Power Shot')) power *= 1.12;
  if (hasTrait(player, 'Finesse')) errSk = clamp(errSk + 0.14, 0, 1);
  if (hm === 'low' && hasTrait(player, 'Low Driven')) power *= 1.1;
  if (hm === 'high' && hasTrait(player, 'Chip Master')) { power *= 1.08; errSk = clamp(errSk + 0.15, 0, 1); }
  if (teams.length && match.state === 'play') {
    var st = statsFor(player.team);
    st.shots++;
    st.xg = Math.round(((st.xg || 0) + clamp(0.42 - d * 0.012 + charge * 0.05, 0.03, 0.6)) * 100) / 100;
    if (Math.random() < 0.55) sayShot(player.name, d > 20);
  }
  kickBall(player, to, power, lift, errSk);
  ball.wasShot = true;
  exciteCrowd(0.35);
}

// skill move (Q): burst past a defender — high-skill players and wingers pull it off more often
function doTrick(p, dir) {
  p.trickCd = 1.6;
  p.trickAnim = 0.45;
  var d = (dir && dir.lengthSq() > 0) ? dir.clone() : p.facing.clone();
  var success = Math.random() < 0.5 + p.skill * 0.45 + (p.style === 'Winger' ? 0.08 : 0) + (hasTrait(p, 'Technical') ? 0.15 : 0);
  if (success) {
    var burst = d.multiplyScalar(5.5);
    p.vel.add(burst);
    if (ball.carrier === p) {
      ball.vel.x += burst.x * 0.8;
      ball.vel.z += burst.z * 0.8;
    }
    exciteCrowd(0.25);
    if (Math.random() < 0.6) sayTrick(p.name);
  } else if (ball.carrier === p) {
    // fluffed it — heavy touch, ball runs loose
    ball.carrier = null;
    ball.vel.set(p.facing.x * 6.5, 0.5, p.facing.z * 6.5);
    ball.lastKicker = p;
    ball.kickCooldown = 0.5;
  }
}

// ---------- Movement ----------
function movePlayer(p, desired, sprinting, dt) {
  if (p.throwIn) desired = new THREE.Vector3();

  if (sprinting && desired.lengthSq() > 0) p.stamina = Math.max(0, p.stamina - p.drain * dt);
  else p.stamina = Math.min(100, p.stamina + 3.5 * dt);
  var staminaMul = 0.82 + 0.18 * (p.stamina / 100);
  var maxSpeed = p.maxSpeed * staminaMul * (sprinting ? 1.32 : 1.0);
  if (ball.carrier === p) maxSpeed *= 0.88;

  var targetVel = desired.clone().multiplyScalar(maxSpeed);
  var dv = targetVel.sub(p.vel);
  var dvLen = dv.length();
  var maxDelta = p.accel * dt;
  if (dvLen > maxDelta) dv.multiplyScalar(maxDelta / dvLen);
  p.vel.add(dv);

  p.pos.addScaledVector(p.vel, dt);
  p.pos.x = clamp(p.pos.x, -HALF_L - 2, HALF_L + 2);
  p.pos.z = clamp(p.pos.z, -HALF_W - 2, HALF_W + 2);

  if (!p.throwIn) {
    if (p.vel.lengthSq() > 0.4) {
      var f = p.vel.clone().normalize();
      p.facing.lerp(f, clamp(10 * dt, 0, 1)).normalize();
    } else if (ball.carrier !== p) {
      var tb = new THREE.Vector3(ball.pos.x - p.pos.x, 0, ball.pos.z - p.pos.z);
      if (tb.lengthSq() > 0.5) p.facing.lerp(tb.normalize(), clamp(3 * dt, 0, 1)).normalize();
    }
  }

  var sp = p.vel.length();
  p.runPhase += dt * (2 + sp * 3.6);
  animateHuman(p.human, sp, p.runPhase, p.throwIn);

  // sliding tackle pose: laid out, legs extended
  if (p.slideTimer > 0) {
    p.slideTimer = Math.max(0, p.slideTimer - dt);
    p.human.torsoGrp.rotation.x = 1.15;
    p.human.legL.rotation.x = 1.35;
    p.human.legR.rotation.x = 1.1;
    p.mesh.position.set(p.pos.x, -0.35, p.pos.z);
    p.mesh.rotation.y = Math.atan2(p.facing.x, p.facing.z);
    p.trickCd = Math.max(0, p.trickCd - dt);
    return;
  }

  p.trickCd = Math.max(0, p.trickCd - dt);
  p.mesh.position.set(p.pos.x, 0, p.pos.z);
  var rotY = Math.atan2(p.facing.x, p.facing.z);
  if (p.trickAnim > 0) {
    p.trickAnim = Math.max(0, p.trickAnim - dt);
    rotY += (1 - p.trickAnim / 0.45) * Math.PI * 2;   // roulette spin
  }
  p.mesh.rotation.y = rotY;
  applyActionAnim(p, dt);
}

// ---------- Trophy scenes (title celebrations with confetti) ----------
var goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.25, emissive: 0x332200 });
function buildTrophy() {
  var g = new THREE.Group();
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0x3e2723 }));
  g.add(base);
  var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.28, 10), goldMat);
  stem.position.y = 0.18;
  g.add(stem);
  var bowl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), goldMat);
  bowl.rotation.x = Math.PI;
  bowl.position.y = 0.42;
  g.add(bowl);
  [-1, 1].forEach(function (sd) {
    var handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 12), goldMat);
    handle.position.set(sd * 0.2, 0.42, 0);
    g.add(handle);
  });
  g.visible = false;
  scene.add(g);
  return g;
}
var trophyMesh = buildTrophy();
var confetti = (function () {
  var N = 500;
  var geo = new THREE.BufferGeometry();
  var pos = new Float32Array(N * 3);
  var col = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) {
    pos[i * 3] = rand(-18, 18); pos[i * 3 + 1] = rand(0, 14); pos[i * 3 + 2] = rand(-18, 18);
    var cc = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  var pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true }));
  pts.visible = false;
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();
var trophyScene = null;
function startTrophyScene(label) {
  var winners = home;
  var cap = null;
  winners.players.forEach(function (p) { if (!cap || p.data.ovr > cap.data.ovr) cap = p; });
  // gather the squad in the centre circle
  winners.players.forEach(function (p, i) {
    if (p === cap) { p.pos.set(0, 0, 0); return; }
    var ang = (i / winners.players.length) * Math.PI * 2;
    p.pos.set(Math.cos(ang) * 2.6, 0, Math.sin(ang) * 2.6);
  });
  trophyScene = { angle: rand(0, 6), captain: cap, label: label };
  trophyMesh.visible = true;
  confetti.visible = true;
  exciteCrowd(1);
  sayParts([
    { t: 'And there it is! ' + winners.name + ' have won ' + label + '!', e: 'euphoric' },
    { t: 'Lift it high, captain! What scenes here at Meridian Park!', e: 'euphoric' },
    { t: 'They will remember this night for a very long time.', e: 'analyst' }
  ], 3);
}
function endTrophyScene() {
  trophyScene = null;
  trophyMesh.visible = false;
  confetti.visible = false;
}
function updateTrophyScene(dt) {
  if (!trophyScene) return false;
  trophyScene.angle += dt * 0.32;
  var cap = trophyScene.captain;
  home.players.forEach(function (p, i) {
    var bounce = Math.abs(Math.sin(perf * 3.2 + i * 1.1)) * 0.28;
    p.mesh.position.set(p.pos.x, bounce, p.pos.z);
    p.mesh.rotation.y = Math.atan2(cap.pos.x - p.pos.x, cap.pos.z - p.pos.z) || 0;
    p.human.armL.rotation.x = -2.9;
    p.human.armR.rotation.x = -2.9;
    if (p.human.kneeL) { p.human.kneeL.rotation.x = 0.2; p.human.kneeR.rotation.x = 0.2; }
  });
  trophyMesh.position.set(cap.pos.x, 2.35 + Math.abs(Math.sin(perf * 3.2)) * 0.28, cap.pos.z);
  trophyMesh.rotation.y += dt * 0.8;
  // confetti rain
  var arr = confetti.geometry.attributes.position.array;
  for (var i2 = 0; i2 < arr.length; i2 += 3) {
    arr[i2 + 1] -= (2.2 + (i2 % 7) * 0.25) * dt;
    arr[i2] += Math.sin(perf * 2 + i2) * 0.01;
    if (arr[i2 + 1] < 0) arr[i2 + 1] = rand(10, 14);
  }
  confetti.geometry.attributes.position.needsUpdate = true;
  return true;
}

// ---------- Action animations (layered over the run cycle) ----------
// p.anim = { type: 'kick'|'throw'|'dive'|'header'|'stumble'|'fall', t, dur, dir }
function setAnim(p, type, dur, dir) {
  if (!p) return;
  p.anim = { type: type, t: dur, dur: dur, dir: dir || 1 };
}
function applyActionAnim(p, dt) {
  var a = p.anim;
  if (!a) { p.mesh.rotation.z = 0; return; }
  a.t -= dt;
  if (a.t <= 0) { p.anim = null; p.mesh.rotation.z = 0; return; }
  var u = 1 - a.t / a.dur;          // 0 → 1 through the animation
  var h = p.human;
  if (a.type === 'kick') {
    // backswing then drive through the ball
    var ang = u < 0.35 ? -1.0 * (u / 0.35) : (-1.0 + 2.4 * ((u - 0.35) / 0.65));
    h.legR.rotation.x = ang;
    if (h.kneeR) h.kneeR.rotation.x = u < 0.35 ? 1.2 : 0.2;
    h.legL.rotation.x = -0.15;
    h.torsoGrp.rotation.x = 0.12 + u * 0.1;
  } else if (a.type === 'throw') {
    var ta = -2.7 + 2.2 * u;        // arms whip forward overhead
    h.armL.rotation.x = ta;
    h.armR.rotation.x = ta;
  } else if (a.type === 'dive') {
    var d = Math.min(1, u * 2.2);
    p.mesh.rotation.z = a.dir * 1.25 * d * (u > 0.75 ? (1 - (u - 0.75) / 0.25) : 1);
    p.mesh.position.y = -0.5 * Math.sin(Math.min(1, u * 1.4) * Math.PI) ;
    h.armL.rotation.x = -2.6;
    h.armR.rotation.x = -2.6;
    if (h.elbowL) { h.elbowL.rotation.x = -0.1; h.elbowR.rotation.x = -0.1; }
  } else if (a.type === 'header') {
    p.mesh.position.y = 0.38 * Math.sin(u * Math.PI);
    h.torsoGrp.rotation.x = 0.45 * Math.sin(u * Math.PI * 2);
  } else if (a.type === 'stumble') {
    h.torsoGrp.rotation.x = 0.6 * Math.sin(u * Math.PI);
    p.mesh.rotation.z = a.dir * 0.25 * Math.sin(u * Math.PI);
  } else if (a.type === 'fall') {
    // go down... then pick yourself back up
    var down = u < 0.45 ? (u / 0.45) : (u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1);
    h.torsoGrp.rotation.x = 1.5 * down;
    p.mesh.position.y = -0.55 * down;
    h.legL.rotation.x = 0.8 * down;
    h.legR.rotation.x = 0.5 * down;
  }
}

function separatePlayers() {
  var ps = allPlayers();
  for (var i = 0; i < ps.length; i++) {
    for (var j = i + 1; j < ps.length; j++) {
      var a = ps[i], b = ps[j];
      var dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.7 && d > 0.001) {
        var push = (0.7 - d) / 2;
        dx /= d; dz /= d;
        a.pos.x -= dx * push; a.pos.z -= dz * push;
        b.pos.x += dx * push; b.pos.z += dz * push;
        // solid bodies: cancel the velocity driving them into each other
        var relV = (b.vel.x - a.vel.x) * dx + (b.vel.z - a.vel.z) * dz;
        if (relV < 0) {
          var imp = relV / 2;
          a.vel.x += dx * imp; a.vel.z += dz * imp;
          b.vel.x -= dx * imp; b.vel.z -= dz * imp;
        }
      }
    }
  }
  // nobody runs through the referee...
  for (var k = 0; k < ps.length; k++) {
    var p2 = ps[k];
    var rx = p2.pos.x - referee.pos.x, rz = p2.pos.z - referee.pos.z;
    var rd = Math.sqrt(rx * rx + rz * rz);
    if (rd < 0.6 && rd > 0.001) {
      p2.pos.x = referee.pos.x + (rx / rd) * 0.6;
      p2.pos.z = referee.pos.z + (rz / rd) * 0.6;
      var vn = (p2.vel.x * rx + p2.vel.z * rz) / rd;
      if (vn < 0) { p2.vel.x -= (rx / rd) * vn; p2.vel.z -= (rz / rd) * vn; }
    }
    // ...or through the goalposts
    for (var gi = 0; gi < 2; gi++) {
      var gx = gi === 0 ? -HALF_L : HALF_L;
      for (var pi = 0; pi < 2; pi++) {
        var pz = pi === 0 ? -GOAL_W / 2 : GOAL_W / 2;
        var px2 = p2.pos.x - gx, pz2 = p2.pos.z - pz;
        var pd = Math.sqrt(px2 * px2 + pz2 * pz2);
        if (pd < 0.4 && pd > 0.001) {
          p2.pos.x = gx + (px2 / pd) * 0.4;
          p2.pos.z = pz + (pz2 / pd) * 0.4;
          var vn2 = (p2.vel.x * px2 + p2.vel.z * pz2) / pd;
          if (vn2 < 0) { p2.vel.x -= (px2 / pd) * vn2; p2.vel.z -= (pz2 / pd) * vn2; }
        }
      }
    }
  }
}

// ---------- AI ----------
var aiTick = 0;
function assignPressers() {
  teams.forEach(function (t) {
    t.players.forEach(function (p) { p.pressJob = false; });
    var hasBall = ball.carrier && ball.carrier.team === t;
    if (hasBall) return;
    if (ball.restartProtect > 0 && ball.carrier) return;
    var count = t.mentality === 'attacking' ? 3 : t.mentality === 'defensive' ? 1 : 2;
    if (!t.isUser) {
      if (save.difficulty >= 4) count++;
      if (save.difficulty <= 1) count = Math.max(1, count - 1);
    }
    var sorted = t.players.filter(function (p) { return p.role !== 'GK'; })
      .sort(function (a, b) {
        // ball-winners hunt the ball more eagerly
        var da = dist2d(a.pos.x, a.pos.z, ball.pos.x, ball.pos.z) - (a.style === 'Ball-Winner' ? 6 : 0);
        var db = dist2d(b.pos.x, b.pos.z, ball.pos.x, ball.pos.z) - (b.style === 'Ball-Winner' ? 6 : 0);
        return da - db;
      });
    for (var i = 0; i < sorted.length && i < count; i++) {
      if (i === 0 || dist2d(sorted[i].pos.x, sorted[i].pos.z, ball.pos.x, ball.pos.z) < 18) {
        sorted[i].pressJob = true;
      }
    }
  });
}

function aiDecideCarrier(p, dt) {
  p.aiThink = (p.aiThink || 0) - dt;
  if (p.aiThink > 0) return;
  p.aiThink = 0.25 * (p.thinkMul || 1);
  var goalX = p.team.attackDir * HALF_L;
  var distGoal = dist2d(p.pos.x, p.pos.z, goalX, 0);
  var opps = otherTeam(p.team).players;
  var nearestOpp = 1e9;
  opps.forEach(function (o) { nearestOpp = Math.min(nearestOpp, dist2d(o.pos.x, o.pos.z, p.pos.x, p.pos.z)); });

  var shootRange = p.style === 'Poacher' ? 26 : 22;
  var passUnder = p.style === 'Playmaker' ? 4.5 : 3.2;
  var passChance = p.style === 'Playmaker' ? 0.9 : p.style === 'Winger' ? 0.6 : 0.8;

  if (distGoal < shootRange && Math.abs(p.pos.z) < 22 && Math.random() < 0.75) {
    doShot(p, new THREE.Vector3(0, 0, rand(-0.6, 0.6)));
    return;
  }
  if (nearestOpp < passUnder && Math.random() < passChance) {
    doPass(p, new THREE.Vector3(p.team.attackDir, 0, rand(-0.7, 0.7)), Math.random() < (p.style === 'Playmaker' ? 0.5 : 0.3));
    return;
  }
  if (Math.random() < (p.style === 'Playmaker' ? 0.12 : 0.06)) {
    doPass(p, new THREE.Vector3(p.team.attackDir, 0, rand(-1, 1)), false);
  }
}

function aiMovement(p, dt) {
  if (p.throwIn) {
    p.throwTimer -= dt;
    if (p.throwTimer <= 0 && !p.team.isUser) {
      doPass(p, new THREE.Vector3(p.team.attackDir * 0.7, 0, -Math.sign(p.pos.z)), false);
    }
    movePlayer(p, new THREE.Vector3(), false, dt);
    return;
  }

  // AI set-piece taker: wait a beat, then deliver into play (never dribble the line)
  if (p.setPiece && ball.carrier === p) {
    p.setPiece.t -= dt;
    if (p.setPiece.t <= 0) {
      if (p.setPiece.type === 'corner') {
        var boxX = p.team.attackDir * (HALF_L - 9);
        var boxZ = rand(-6, 6);
        var cd = dist2d(p.pos.x, p.pos.z, boxX, boxZ);
        kickBall(p, new THREE.Vector3(boxX - p.pos.x, 0, boxZ - p.pos.z), clamp(cd * 0.5 + 8, 10, 22), 4.5, p.passSkill);
      } else {
        doPass(p, new THREE.Vector3(p.team.attackDir, 0, rand(-0.8, 0.8)), Math.random() < 0.4);
      }
      p.setPiece = null;
    }
    movePlayer(p, new THREE.Vector3(), false, dt);
    return;
  }
  if (p.setPiece && ball.carrier !== p) p.setPiece = null;

  if (p.role === 'GK' && ball.carrier === p && !(p.holdBall > 0)) p.holdBall = 1.0;

  if (p.holdBall > 0) {
    p.holdBall -= dt;
    if (p.holdBall <= 0 && ball.carrier === p) {
      doPass(p, new THREE.Vector3(p.team.attackDir, 0, rand(-0.6, 0.6)), true);
    }
    movePlayer(p, new THREE.Vector3(), false, dt);
    return;
  }

  if (p.role === 'GK') { aiKeeper(p, dt); return; }

  var desired = new THREE.Vector3();
  var sprinting = false;

  if (ball.carrier === p) {
    var goalX = p.team.attackDir * HALF_L;
    var dir = new THREE.Vector3(goalX - p.pos.x, 0, 0);
    dir.z += (0 - p.pos.z) * 0.02;
    var opps = otherTeam(p.team).players;
    var near = null, nd = 1e9;
    opps.forEach(function (o) { var d = dist2d(o.pos.x, o.pos.z, p.pos.x, p.pos.z); if (d < nd) { nd = d; near = o; } });
    if (near && nd < 5) dir.z += (p.pos.z - near.pos.z) > 0 ? 6 : -6;
    dir.normalize();
    desired.copy(dir);
    sprinting = nd > 6;
    aiDecideCarrier(p, dt);
  } else if (p.pressJob) {
    var tx = ball.pos.x + ball.vel.x * 0.25, tz = ball.pos.z + ball.vel.z * 0.25;
    desired.set(tx - p.pos.x, 0, tz - p.pos.z);
    if (desired.lengthSq() > 0) desired.normalize();
    sprinting = dist2d(p.pos.x, p.pos.z, ball.pos.x, ball.pos.z) > 6;
    if (ball.carrier && ball.carrier.team !== p.team && !ball.carrier.throwIn &&
        dist2d(p.pos.x, p.pos.z, ball.carrier.pos.x, ball.carrier.pos.z) < 1.25) {
      attemptTackle(p, ball.carrier, dt, false);
    }
  } else {
    var fp = p.team.formationPoint(p, ball.pos);
    var teamHasBall = ball.carrier && ball.carrier.team === p.team;
    if (teamHasBall && p.role === 'FW') {
      fp.x += p.team.attackDir * 8;
      fp.x = clamp(fp.x, -HALF_L + 2, HALF_L - 3);
    }
    if (teamHasBall && p.role === 'MF') fp.x += p.team.attackDir * 4;
    desired.set(fp.x - p.pos.x, 0, fp.z - p.pos.z);
    var d = desired.length();
    if (d < 0.6) desired.set(0, 0, 0);
    else { desired.normalize(); if (d < 3) desired.multiplyScalar(0.5); }
    sprinting = d > 14;
  }

  movePlayer(p, desired, sprinting, dt);
}

function aiKeeper(p, dt) {
  var ownGoalX = -p.team.attackDir * HALF_L;
  var desired = new THREE.Vector3();
  var tz = clamp(ball.pos.z * 0.25, -3.2, 3.2);
  var tx = ownGoalX + p.team.attackDir * clamp(1.0 + Math.abs(ball.pos.x - ownGoalX) * 0.04, 1, 4);

  var ballComing = Math.sign(ball.vel.x) === Math.sign(ownGoalX - ball.pos.x) && Math.abs(ball.vel.x) > 4;
  var ballClose = dist2d(ball.pos.x, ball.pos.z, ownGoalX, 0) < 20;
  if (ballComing && ballClose) {
    var t = Math.abs((ownGoalX - ball.pos.x) / (ball.vel.x || 0.001));
    if (t < 2.5) {
      tz = clamp(ball.pos.z + ball.vel.z * t, -GOAL_W / 2 - 0.5, GOAL_W / 2 + 0.5);
      tx = ownGoalX + p.team.attackDir * 0.8;
    }
  }
  var claimR = hasTrait(p, 'Sweeper Keeper') ? 22 : 14;
  if (!ball.carrier && ball.vel.length() < 5 && dist2d(ball.pos.x, ball.pos.z, ownGoalX, 0) < claimR) {
    tx = ball.pos.x; tz = ball.pos.z;
  }

  desired.set(tx - p.pos.x, 0, tz - p.pos.z);
  var d = desired.length();
  if (d < 0.2) desired.set(0, 0, 0); else desired.normalize();
  movePlayer(p, desired, d > 4, dt);

  var reach = 1.9;
  var bd = dist2d(p.pos.x, p.pos.z, ball.pos.x, ball.pos.z);
  if (!ball.carrier && bd < reach && ball.pos.y < 2.3) {
    var sp = ball.vel.length();
    var shotAtGoal = Math.sign(ball.vel.x) === Math.sign(ownGoalX - ball.pos.x);
    if (sp > 9 && shotAtGoal && ball.kickCooldown < 0.35) {
      // keeper rating matters, but hard-struck shots are much harder to keep out
      var saveChance = clamp(0.15 + p.defSkill / 170 - Math.max(0, sp - 16) * 0.022, 0.1, 0.8);
      if (hasTrait(p, 'Cat Reflexes')) saveChance = clamp(saveChance + 0.12, 0, 0.9);
      if (ball.lastKicker && ball.lastKicker.team !== p.team && match.state === 'play') {
        statsFor(ball.lastKicker.team).onT++;
      }
      if (Math.random() < saveChance) {
        setAnim(p, 'dive', 0.75, Math.sign(ball.pos.z - p.pos.z) * (p.team.attackDir >= 0 ? 1 : -1) || 1);
        saySave(p.name);
        p.matchRating = clamp((p.matchRating || 6) + 0.3, 4, 10);
        if (sp < 15 && Math.random() < 0.35) {
          ball.carrier = p;
          ball.vel.set(0, 0, 0);
          ball.pos.y = BALL_R;
          p.holdBall = 1.1;
          ball.lastTouchTeam = p.team;
          ball.lastKicker = p;
          exciteCrowd(0.4);
        } else {
          ball.vel.x = -ball.vel.x * 0.35;
          ball.vel.z += rand(-6, 6) + Math.sign(ball.pos.z || rand(-1, 1)) * 5;
          ball.vel.y = Math.abs(ball.vel.y) * 0.4 + 2.5;
          ball.lastTouchTeam = p.team;
          ball.kickCooldown = 0.4;
          ball.lastKicker = p;
          exciteCrowd(0.5);
          kickSound(8);
        }
      }
    }
  }
}

// ---------- User control ----------
function pickControlledPlayer() {
  if (!home) return;
  if (ball.carrier && ball.carrier.team === home && ball.carrier.role !== 'GK') {
    controlledPlayer = ball.carrier;
    return;
  }
  var candidate = nearestPlayer(home, ball.pos, true);
  if (!controlledPlayer || controlledPlayer.sentOff || controlledPlayer.role === 'GK') { controlledPlayer = candidate; return; }
  var curD = dist2d(controlledPlayer.pos.x, controlledPlayer.pos.z, ball.pos.x, ball.pos.z);
  var newD = candidate ? dist2d(candidate.pos.x, candidate.pos.z, ball.pos.x, ball.pos.z) : 1e9;
  if (newD < curD - 2.0) controlledPlayer = candidate;
}

function updateUser(dt) {
  if (justPressed['KeyC']) {
    var sorted = home.players.filter(function (p) { return p.role !== 'GK' && p !== controlledPlayer; })
      .sort(function (a, b) {
        return dist2d(a.pos.x, a.pos.z, ball.pos.x, ball.pos.z) - dist2d(b.pos.x, b.pos.z, ball.pos.x, ball.pos.z);
      });
    if (sorted[0]) controlledPlayer = sorted[0];
  } else if (!ball.carrier || ball.carrier.team !== home) {
    pickControlledPlayer();
  } else if (ball.carrier.team === home && ball.carrier.role !== 'GK') {
    controlledPlayer = ball.carrier;
  }

  var p = controlledPlayer;
  if (!p) return;
  var dir = inputDir();
  var sprinting = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  movePlayer(p, dir, sprinting, dt);

  var hasBall = ball.carrier === p;
  if (hasBall) {
    if (p.throwIn) {
      if (justPressed['Space'] || justPressed['KeyL']) doPass(p, dir, justPressed['KeyL']);
      return;
    }
    if (justPressed['Space']) { cancelCharge(); doPass(p, dir, false); }
    else if (justPressed['KeyL']) { cancelCharge(); doPass(p, dir, true); }
    else if (justPressed['KeyQ'] && p.trickCd <= 0) { doTrick(p, dir); }
    else {
      // hold K to charge a shot, release to fire
      if (justPressed['KeyK']) { chargingP = p; shotCharge = 0.08; }
      if (chargingP === p) {
        if (keys['KeyK']) shotCharge = Math.min(1, shotCharge + dt / 1.05);
        else {
          var c = shotCharge;
          cancelCharge();
          if (ball.carrier === p) doShot(p, dir, c);
        }
      }
    }
  } else {
    cancelCharge();
    // VOLLEY: strike a loose airborne ball first-time
    if (justPressed['KeyK'] && !ball.carrier && ball.pos.y > 0.45 && ball.pos.y < 2.1 &&
        dist2d(p.pos.x, p.pos.z, ball.pos.x, ball.pos.z) < 1.45) {
      var goalXv = p.team.attackDir * HALF_L;
      var aimZv = clamp(dir.z * 3.2 + rand(-1.4, 1.4) * (1.2 - p.shootSkill), -GOAL_W / 2 + 0.4, GOAL_W / 2 - 0.4);
      var toV = new THREE.Vector3(goalXv - p.pos.x, 0, aimZv - p.pos.z);
      if (teams.length && match.state === 'play') {
        var stV = statsFor(p.team);
        stV.shots++;
        stV.xg = Math.round(((stV.xg || 0) + 0.12) * 100) / 100;
      }
      kickBall(p, toV, clamp(19 + p.data.shoot * 0.06, 19, 29), rand(2, 4), p.shootSkill * 0.85);
      commentate('chance');
      exciteCrowd(0.4);
      return;
    }
    if ((justPressed['Space'] || justPressed['KeyK']) && ball.carrier &&
        ball.carrier.team !== home && !ball.carrier.throwIn) {
      if (dist2d(p.pos.x, p.pos.z, ball.carrier.pos.x, ball.carrier.pos.z) < 1.6) {
        attemptTackle(p, ball.carrier, dt, true);
      }
    }
    // sliding tackle: a committed lunge — long reach, high risk
    if (justPressed['KeyJ'] && p.slideTimer <= 0) {
      var sdir = dir.lengthSq() > 0 ? dir.clone() : p.facing.clone();
      p.slideTimer = 0.6;
      p.slideHit = false;
      p.vel.addScaledVector(sdir, 7.5);
    }
    if (p.slideTimer > 0 && !p.slideHit) {
      if (ball.carrier && ball.carrier.team !== home && !ball.carrier.throwIn &&
          dist2d(p.pos.x, p.pos.z, ball.carrier.pos.x, ball.carrier.pos.z) < 1.5) {
        p.slideHit = true;
        attemptTackle(p, ball.carrier, dt, true, true);
      } else if (!ball.carrier && dist2d(p.pos.x, p.pos.z, ball.pos.x, ball.pos.z) < 1.1) {
        p.slideHit = true;
        var away3 = p.facing.clone();
        ball.vel.x += away3.x * 8;
        ball.vel.z += away3.z * 8;
        ball.lastKicker = p;
        ball.lastTouchTeam = home;
        ball.kickCooldown = 0.4;
        kickSound(8);
      }
    }
  }
}
var chargingP = null, shotCharge = 0;
function cancelCharge() { chargingP = null; shotCharge = 0; }

// ---------- Camera ----------
var CAMERA_NAMES = ['Broadcast', 'Tele High', 'Pitchside', 'End-to-End'];
var camTarget = new THREE.Vector3();
function updateCamera(dt) {
  var desired, look;
  if (trophyScene) {
    // slow orbit around the trophy lift
    var ta = trophyScene.angle;
    camera.position.lerp(new THREE.Vector3(Math.cos(ta) * 13, 5.5, Math.sin(ta) * 13), clamp(2.5 * dt, 0, 1));
    camTarget.lerp(new THREE.Vector3(0, 1.6, 0), clamp(3 * dt, 0, 1));
    camera.lookAt(camTarget);
    return;
  }
  if (match.replay) {
    // cinematic replay camera: low, near the goal the ball is heading for
    var bp = ballMesh.position;
    var gs = Math.sign(bp.x) || 1;
    desired = new THREE.Vector3(gs * (HALF_L - 14), 6, bp.z > 0 ? 24 : -24);
    camera.position.lerp(desired, clamp(3.5 * dt, 0, 1));
    camTarget.lerp(bp, clamp(5 * dt, 0, 1));
    camera.lookAt(camTarget);
    return;
  }
  var mode = save.camera || 0;
  var fx = clamp(ball.pos.x * 0.82, -HALF_L + 12, HALF_L - 12);
  var fz = clamp(ball.pos.z * 0.45, -14, 14);
  if (mode === 1) {          // Tele High: wide tactical view
    desired = new THREE.Vector3(fx * 0.7, 46, fz + 60);
    look = new THREE.Vector3(fx * 0.8, 0, fz * 0.5);
  } else if (mode === 2) {   // Pitchside: low and close
    desired = new THREE.Vector3(fx, 13, fz + 27);
    look = new THREE.Vector3(fx, 1, fz * 0.7);
  } else if (mode === 3) {   // End-to-End: behind your attack
    var ad = home ? home.attackDir : 1;
    desired = new THREE.Vector3(clamp(ball.pos.x, -HALF_L, HALF_L) - ad * 34, 20, ball.pos.z * 0.4);
    look = new THREE.Vector3(ball.pos.x + ad * 10, 0, ball.pos.z * 0.6);
  } else {                    // Broadcast
    desired = new THREE.Vector3(fx, 30, fz + 46);
    look = new THREE.Vector3(fx, 0, fz * 0.6);
  }
  camera.position.lerp(desired, clamp(2.2 * dt, 0, 1));
  camTarget.lerp(look, clamp(2.6 * dt, 0, 1));
  camera.lookAt(camTarget);
}
camera.position.set(0, 30, 46);
camera.lookAt(0, 0, 0);

// ---------- Season / match flow ----------
function cupSimWinner(a, b) {
  var ga = simGoalsBetween(strengthOf(a), strengthOf(b));
  var gb = simGoalsBetween(strengthOf(b), strengthOf(a));
  if (ga === gb) return Math.random() < strengthOf(a) / (strengthOf(a) + strengthOf(b)) ? a : b;
  return ga > gb ? a : b;
}
// Champions Cup — played AFTER the league season, like the real thing.
// 32 clubs → 8 groups of 4 → top 2 per group (16) → Round of 16 → Final.
function cupQualifiersFromTables() {
  var d1Final = sortedTableOf('d1', save.divisions.d1).map(function (r) { return r.name; });
  var qual = d1Final.slice(0, 8);            // top 8 of Division 1 only — Div 2 gets no spots
  FOREIGN_LEAGUES.forEach(function (L) {
    var rows = sortedTableOf(L.key, L.clubs.map(function (c) { return c.name; })).map(function (r) { return r.name; });
    qual = qual.concat(rows.slice(0, 8));    // top 8 of each foreign league
  });
  return qual.slice(0, 32);
}
function groupRoundPairs(g, r) {
  if (r === 0) return [[g[0], g[1]], [g[2], g[3]]];
  if (r === 1) return [[g[0], g[2]], [g[1], g[3]]];
  return [[g[0], g[3]], [g[1], g[2]]];
}
function groupStandings(gi) {
  var c = save.cup;
  return c.groups[gi].map(function (n) { return { name: n, r: c.groupTables[gi][n] }; })
    .sort(function (a, b) {
      var pa = pts(a.r), pb = pts(b.r);
      if (pb !== pa) return pb - pa;
      var gda = a.r.GF - a.r.GA, gdb = b.r.GF - b.r.GA;
      if (gdb !== gda) return gdb - gda;
      return b.r.GF - a.r.GF;
    });
}
function drawGroupMatch() {
  var c = save.cup;
  var prs = groupRoundPairs(c.groups[c.hardyGroup], c.groupRound);
  var mine = prs[0].indexOf(HARDY_DEF.name) >= 0 ? prs[0] : prs[1];
  var other = prs[0].indexOf(HARDY_DEF.name) >= 0 ? prs[1] : prs[0];
  save.cupPending = {
    stage: 'group',
    round: c.groupRound,
    opp: mine[0] === HARDY_DEF.name ? mine[1] : mine[0],
    otherPair: other
  };
}
function resolveGroups() {
  var c = save.cup;
  var alive = [];
  c.groups.forEach(function (g, gi) {
    var rows = groupStandings(gi);
    alive.push(rows[0].name, rows[1].name);
  });
  c.stage = 'ko';
  c.alive = shuffled(alive);
  c.round = 0;
  c.hardyIn = alive.indexOf(HARDY_DEF.name) >= 0;
}
function drawCupRound() {
  var c = save.cup;
  var pool = shuffled(c.alive);
  pool.splice(pool.indexOf(HARDY_DEF.name), 1);
  var opp = pool.shift();
  var pairs = [];
  for (var j = 0; j + 1 < pool.length; j += 2) pairs.push([pool[j], pool[j + 1]]);
  save.cupPending = { stage: 'ko', round: c.round, opp: opp, pairs: pairs };
}
function simulateCupToEnd() {
  var c = save.cup;
  if (c.stage === 'groups') {
    for (; c.groupRound < 3; c.groupRound++) {
      c.groups.forEach(function (g, gi) {
        groupRoundPairs(g, c.groupRound).forEach(function (pr) {
          recordResultIn(c.groupTables[gi], pr[0], pr[1],
            simGoalsBetween(strengthOf(pr[0]), strengthOf(pr[1])),
            simGoalsBetween(strengthOf(pr[1]), strengthOf(pr[0])));
        });
      });
    }
    resolveGroups();
  }
  while (c.alive.length > 1) {
    var winners = [];
    var pool = shuffled(c.alive);
    for (var k = 0; k + 1 < pool.length; k += 2) winners.push(cupSimWinner(pool[k], pool[k + 1]));
    c.alive = winners;
    c.round++;
  }
  c.done = true;
  c.winner = c.alive[0];
  save.cupPending = null;
}
// ---------- Club World Cup (4 league champions) & World Cup (8 nations) ----------
function buildCWC() {
  var champs = [sortedTableOf('d1', save.divisions.d1)[0].name];
  FOREIGN_LEAGUES.forEach(function (L) {
    champs.push(sortedTableOf(L.key, L.clubs.map(function (c) { return c.name; }))[0].name);
  });
  save.cwc = { teams: champs.slice(), alive: shuffled(champs), round: 0, hardyIn: champs.indexOf(HARDY_DEF.name) >= 0, done: false, winner: null };
  if (save.cwc.hardyIn) drawCWCRound();
  else {
    var c = save.cwc;
    while (c.alive.length > 1) {
      var w = [];
      for (var k = 0; k + 1 < c.alive.length; k += 2) w.push(cupSimWinner(c.alive[k], c.alive[k + 1]));
      c.alive = w; c.round++;
    }
    c.done = true; c.winner = c.alive[0];
  }
}
function drawCWCRound() {
  var c = save.cwc;
  var pool = shuffled(c.alive);
  pool.splice(pool.indexOf(HARDY_DEF.name), 1);
  var opp = pool.shift();
  save.cwcPending = { round: c.round, opp: opp, others: pool };
}
function buildWC() {
  var names = NATIONS.map(function (n) { return n.name; });
  save.wc = { alive: shuffled(names), round: 0, hardyIn: true, done: false, winner: null, squad: null };
  drawWCRound();
}
function drawWCRound() {
  var c = save.wc;
  var pool = shuffled(c.alive);
  pool.splice(pool.indexOf(MERIDIA_DEF.name), 1);
  var opp = pool.shift();
  var pairs = [];
  for (var j = 0; j + 1 < pool.length; j += 2) pairs.push([pool[j], pool[j + 1]]);
  save.wcPending = { round: c.round, opp: opp, pairs: pairs };
}
function simWCToEnd() {
  var c = save.wc;
  while (c.alive.length > 1) {
    var w = [];
    var pool = shuffled(c.alive);
    for (var k = 0; k + 1 < pool.length; k += 2) w.push(cupSimWinner(pool[k], pool[k + 1]));
    c.alive = w; c.round++;
  }
  c.done = true; c.winner = c.alive[0];
  save.wcPending = null;
}
// after the Champions Cup: Club World Cup, then (every 4th season) the World Cup
function nextPostSeasonStep() {
  if (!save.cwc) buildCWC();
  if (save.cwcPending) return true;
  if (!save.wc && save.season % 4 === 0) buildWC();
  if (save.wcPending) return true;
  return false;
}
function awardTrophy(title) {
  save.trophies = save.trophies || [];
  save.trophies.push({ t: title, s: save.season });
}

function startCup() {
  var qual = cupQualifiersFromTables();
  var pool = shuffled(qual);
  var c = {
    stage: 'groups',
    groupRound: 0,
    groups: [],
    groupTables: [],
    qualified: qual.slice(),
    hardyIn: qual.indexOf(HARDY_DEF.name) >= 0,
    hardyGroup: -1,
    round: 0,
    alive: [],
    pairs: null,
    done: false,
    winner: null
  };
  for (var i = 0; i < 8; i++) {
    var g = pool.slice(i * 4, i * 4 + 4);
    c.groups.push(g);
    c.groupTables.push(tableFor(g));
    if (g.indexOf(HARDY_DEF.name) >= 0) c.hardyGroup = i;
  }
  save.cup = c;
  if (c.hardyIn) drawGroupMatch();
  else simulateCupToEnd();
}

function finishMatch() {
  match.state = 'fulltime';
  whistle(3);
  exciteCrowd(0.8);
  say('There is the final whistle! It finishes ' + home.name + ' ' + home.score + ', ' + away.name + ' ' + away.score + '.', 3,
    home.score > away.score ? 'excited' : home.score < away.score ? 'sad' : 'build');
  if (match.recorded) return;
  match.recorded = true;

  var isCup = match.fixture && match.fixture.type === 'cup';
  var extra = '';
  if (isCup && save.cupPending) {
    var c = save.cup;
    var pend = save.cupPending;
    var hWin = home.score > away.score;
    if (pend.stage === 'group') {
      // group match: draws stand, points decide who advances
      recordResultIn(c.groupTables[c.hardyGroup], home.name, away.name, home.score, away.score);
      var op = pend.otherPair || [];
      if (op.length === 2) {
        recordResultIn(c.groupTables[c.hardyGroup], op[0], op[1],
          simGoalsBetween(strengthOf(op[0]), strengthOf(op[1])),
          simGoalsBetween(strengthOf(op[1]), strengthOf(op[0])));
      }
      c.groups.forEach(function (g, gi) {
        if (gi === c.hardyGroup) return;
        groupRoundPairs(g, c.groupRound).forEach(function (pr) {
          recordResultIn(c.groupTables[gi], pr[0], pr[1],
            simGoalsBetween(strengthOf(pr[0]), strengthOf(pr[1])),
            simGoalsBetween(strengthOf(pr[1]), strengthOf(pr[0])));
        });
      });
      c.groupRound++;
      save.cupPending = null;
      var gReward = hWin ? 0.8 : (home.score === away.score ? 0.4 : 0);
      save.budget = Math.round((save.budget + gReward) * 10) / 10;
      if (c.groupRound < 3) {
        drawGroupMatch();
        extra = (gReward ? 'Prize ' + fmtM(gReward) + '.  ' : '') + 'Group match ' + (c.groupRound + 1) + ' of 3 — vs ' + save.cupPending.opp + ' next!';
      } else {
        resolveGroups();
        if (c.hardyIn) {
          drawCupRound();
          extra = '✔ TOP 2 OF THE GROUP — through to the Round of 16, vs ' + save.cupPending.opp + '!';
        } else {
          simulateCupToEnd();
          extra = '✘ Out at the group stage.  Cup winners: ' + c.winner + '  ·  press 6 for the season awards';
        }
      }
      showMessage('FULL TIME', 'CUP GROUP STAGE: ' + home.name + ' ' + home.score + ' – ' + away.score + ' ' + away.name + '  ·  ' + extra + '   (6 = continue)', 9999);
    } else {
      // knockout: a draw goes to penalties
      var roundIdx = pend.round;
      var shootout = '';
      if (home.score === away.score) {
        hWin = Math.random() < 0.5 + (avgOvr(home) - avgOvr(away)) / 200;
        shootout = hWin ? '  — won on penalties!' : '  — lost on penalties';
      }
      var winners = [];
      (pend.pairs || []).forEach(function (pr) { winners.push(cupSimWinner(pr[0], pr[1])); });
      winners.push(hWin ? HARDY_DEF.name : away.name);
      if (!hWin) c.hardyIn = false;
      c.alive = winners;
      c.round = roundIdx + 1;
      save.cupPending = null;
      var reward = hWin ? CUP_PRIZES[roundIdx] : (roundIdx === 3 ? 6 : 0);
      save.budget = Math.round((save.budget + reward) * 10) / 10;
      if (roundIdx === 3 && hWin) {
        c.done = true;
        c.winner = HARDY_DEF.name;
        awardTrophy('Champions Cup');
        startTrophyScene('THE CHAMPIONS CUP');
        extra = '🏆 HARDY FC WIN THE CHAMPIONS CUP!  Prize ' + fmtM(reward) + '  ·  press 6 to continue';
      } else if (hWin) {
        drawCupRound();
        extra = 'Through to the ' + CUP_ROUND_NAMES[roundIdx + 1] + ' — vs ' + save.cupPending.opp + ' next!' + (reward ? '  Prize ' + fmtM(reward) : '');
      } else {
        simulateCupToEnd();
        extra = 'Out of the cup.' + (reward ? '  Prize ' + fmtM(reward) : '') + '  Cup winners: ' + c.winner + '  ·  press 6 for the season awards';
      }
      showMessage('FULL TIME', 'CUP ' + CUP_ROUND_NAMES[roundIdx].toUpperCase() + ': ' + home.name + ' ' + home.score + ' – ' + away.score + ' ' + away.name + shootout + '  ·  ' + extra + '   (6 = continue)', 9999);
    }
  } else if (match.fixture && match.fixture.type === 'cwc' && save.cwcPending) {
    var cw = save.cwc;
    var cwPend = save.cwcPending;
    var cwWin = home.score > away.score;
    var cwShoot = '';
    if (home.score === away.score) {
      cwWin = Math.random() < 0.5 + (avgOvr(home) - avgOvr(away)) / 200;
      cwShoot = cwWin ? '  — won on penalties!' : '  — lost on penalties';
    }
    save.cwcPending = null;
    if (cwPend.round === 0) {
      var otherWinner = cupSimWinner(cwPend.others[0], cwPend.others[1]);
      if (cwWin) {
        cw.alive = [HARDY_DEF.name, otherWinner];
        cw.round = 1;
        save.budget = Math.round((save.budget + 3) * 10) / 10;
        drawCWCRound();
        extra = 'Prize ' + fmtM(3) + '.  CLUB WORLD CUP FINAL vs ' + save.cwcPending.opp + ' next!';
      } else {
        cw.done = true;
        cw.winner = cupSimWinner(away.name, otherWinner);
        cw.hardyIn = false;
        extra = 'Out of the Club World Cup — won by ' + cw.winner + '.  Press 6 to continue';
      }
      showMessage('FULL TIME', 'CLUB WORLD CUP SEMI-FINAL: ' + home.name + ' ' + home.score + ' – ' + away.score + ' ' + away.name + cwShoot + '  ·  ' + extra + '   (6 = continue)', 9999);
    } else {
      cw.done = true;
      cw.winner = cwWin ? HARDY_DEF.name : away.name;
      var cwReward = cwWin ? 8 : 4;
      save.budget = Math.round((save.budget + cwReward) * 10) / 10;
      if (cwWin) { awardTrophy('Club World Cup'); startTrophyScene('THE CLUB WORLD CUP'); }
      extra = (cwWin ? '🏆 HARDY FC ARE CLUB WORLD CHAMPIONS!' : 'Runners-up in the Club World Cup.') + '  Prize ' + fmtM(cwReward) + '  ·  press 6 to continue';
      showMessage('FULL TIME', 'CLUB WORLD CUP FINAL: ' + home.name + ' ' + home.score + ' – ' + away.score + ' ' + away.name + cwShoot + '  ·  ' + extra + '   (6 = continue)', 9999);
    }
    persist();
    renderStatsPanel('FULL TIME');
    return;
  } else if (match.fixture && match.fixture.type === 'wc' && save.wcPending) {
    var wc = save.wc;
    var wcPend = save.wcPending;
    var wcWin = home.score > away.score;
    var wcShoot = '';
    if (home.score === away.score) {
      wcWin = Math.random() < 0.5 + (avgOvr(home) - avgOvr(away)) / 200;
      wcShoot = wcWin ? '  — won on penalties!' : '  — lost on penalties';
    }
    var wcNames = ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];
    var wcWinners = [];
    (wcPend.pairs || []).forEach(function (pr) { wcWinners.push(cupSimWinner(pr[0], pr[1])); });
    wcWinners.push(wcWin ? MERIDIA_DEF.name : away.name);
    wc.alive = wcWinners;
    wc.round = wcPend.round + 1;
    save.wcPending = null;
    var wcReward = wcWin ? [1.5, 2.5, 8][wcPend.round] : (wcPend.round === 2 ? 4 : 0);
    save.budget = Math.round((save.budget + wcReward) * 10) / 10;
    if (wcPend.round === 2 && wcWin) {
      wc.done = true;
      wc.winner = MERIDIA_DEF.name;
      awardTrophy('World Cup (Meridia)');
      startTrophyScene('THE WORLD CUP');
      extra = '🏆 MERIDIA ARE WORLD CHAMPIONS!  Federation bonus ' + fmtM(wcReward) + '  ·  press 6 for the season awards';
    } else if (wcWin) {
      drawWCRound();
      extra = 'Through to the ' + wcNames[wcPend.round + 1] + ' — vs ' + save.wcPending.opp + ' next!' + (wcReward ? '  Bonus ' + fmtM(wcReward) : '');
    } else {
      wc.hardyIn = false;
      simWCToEnd();
      extra = 'Meridia are out.  World Cup winners: ' + wc.winner + '  ·  press 6 for the season awards';
    }
    showMessage('FULL TIME', 'WORLD CUP ' + wcNames[wcPend.round] + ': ' + home.name + ' ' + home.score + ' – ' + away.score + ' ' + away.name + wcShoot + '  ·  ' + extra + '   (6 = continue)', 9999);
    persist();
    renderStatsPanel('FULL TIME');
    return;
  } else {
    save.md++;
    recordResultIn(save.tables[ownDivisionKey()], home.name, away.name, home.score, away.score);
    simulateWorldRound(away.name);
    var reward2 = home.score > away.score ? 3 : home.score === away.score ? 1.5 : 0.5;
    save.budget = Math.round((save.budget + reward2) * 10) / 10;
    extra = 'Prize money: ' + fmtM(reward2);
    if (save.md >= SEASON_MDS) {
      startCup();
      if (save.cup.hardyIn) {
        extra += '  ·  LEAGUE SEASON DONE — the CHAMPIONS CUP GROUP STAGE begins: vs ' + save.cupPending.opp + ' next!';
      } else {
        extra += '  ·  Season over — not qualified for the Champions Cup (won by ' + save.cup.winner + ').  Press 6 for the awards';
      }
    }
    var res = home.score > away.score ? home.name + ' win!' : away.score > home.score ? away.name + ' win!' : 'A draw!';
    showMessage('FULL TIME', home.name + ' ' + home.score + ' – ' + away.score + ' ' + away.name + '  —  ' + res + '  ·  ' + extra + '   (6 = continue)', 9999);
  }
  persist();
  renderStatsPanel('FULL TIME');
}

// each summer: young players grow toward their potential, veterans decline
function applyGrowth() {
  var grew = [], declined = [];
  save.squad.forEach(function (p) {
    p.age = (p.age || 24) + 1;
    if (p.pot === undefined) p.pot = p.ovr;
    var oldOvr = p.ovr;
    var delta;
    if (p.age <= 23 && p.ovr < p.pot) delta = Math.min(p.pot - p.ovr, irand(2, 4));
    else if (p.age <= 27 && p.ovr < p.pot) delta = Math.min(p.pot - p.ovr, irand(0, 2));
    else if (p.age >= 32) delta = -irand(2, 4);
    else if (p.age >= 29) delta = -irand(0, 2);
    else delta = 0;
    if (delta !== 0) {
      ['pace', 'shoot', 'pass', 'def', 'phys'].forEach(function (a) {
        var d = delta + irand(-1, 1);
        if (a === 'pace' && delta < 0) d -= 1;      // legs go first
        p[a] = clamp(p[a] + d, 30, 97);
      });
      p.ovr = calcOvr(p);
      p.pot = Math.max(p.pot, p.ovr);
      p.value = playerValue(p.ovr);
      if (p.ovr > oldOvr) grew.push(p.name + ' +' + (p.ovr - oldOvr));
      else if (p.ovr < oldOvr) declined.push(p.name + ' ' + (p.ovr - oldOvr));
    }
  });
  return { grew: grew, declined: declined };
}
// the academy graduates youngsters every summer — better academy, better kids
function youthIntake() {
  var lvl = save.academyLvl || 1;
  var count = lvl >= 5 ? 4 : lvl >= 3 ? 3 : 2;
  var used = usedNamesFromSquad();
  var grads = [];
  for (var i = 0; i < count && save.squad.length < 22; i++) {
    var y = genPlayer(pick(['DF', 'MF', 'MF', 'FW', 'GK']), 50 + lvl * 3 + irand(0, 6), used);
    y.age = irand(16, 18);
    y.pot = clamp(y.ovr + irand(10, 18) + lvl * 2, y.ovr, 97);
    y.contract = 3;
    y.value = playerValue(y.ovr);
    save.squad.push(y);
    grads.push(y.name + ' (' + y.role + ', ' + y.ovr + ' OVR, potential ' + y.pot + ')');
  }
  return grads;
}

function endSeason() {
  var ownKey = ownDivisionKey();
  var rowsOwn = sortedTableOf(ownKey, save.divisions[ownKey]).map(function (r) { return r.name; });
  var posIdx = rowsOwn.indexOf(HARDY_DEF.name);
  var prize = Math.max(2, Math.round(((save.division === 1 ? 20 : 10) - posIdx * (save.division === 1 ? 1.1 : 0.5)) * 10) / 10);
  save.budget = Math.round((save.budget + prize) * 10) / 10;
  save.lastCupWinner = (save.cup && save.cup.winner) || null;

  // relegation & promotion: bottom 3 of Div 1 swap with top 3 of Div 2
  var d1Final = sortedTableOf('d1', save.divisions.d1).map(function (r) { return r.name; });
  var d2Final = sortedTableOf('d2', save.divisions.d2).map(function (r) { return r.name; });
  var down = d1Final.slice(-3), up = d2Final.slice(0, 3);
  save.divisions.d1 = d1Final.slice(0, d1Final.length - 3).concat(up);
  save.divisions.d2 = d2Final.slice(3).concat(down);
  var moveMsg = '';
  if (save.division === 1 && down.indexOf(HARDY_DEF.name) >= 0) { save.division = 2; moveMsg = '  ⬇ RELEGATED to Meridian League 2.'; }
  else if (save.division === 2 && up.indexOf(HARDY_DEF.name) >= 0) { save.division = 1; moveMsg = '  ⬆ PROMOTED to the Meridian League!'; }
  var champMsg = '';
  if (posIdx === 0) {
    champMsg = (save.division === 1 && !moveMsg ? '  🏆 CHAMPIONS OF THE MERIDIAN LEAGUE!' : '  🏆 League title!');
    awardTrophy(save.division === 1 ? 'Meridian League Champions' : 'Meridian League 2 Title');
    startTrophyScene(save.division === 1 ? 'THE MERIDIAN LEAGUE TITLE' : 'THE LEAGUE 2 TITLE');
  }
  var cupMsg = save.lastCupWinner ? '  Champions Cup winners: ' + save.lastCupWinner + '.' : '';
  if (save.cwc && save.cwc.winner) cupMsg += '  Club World Cup: ' + save.cwc.winner + '.';
  if (save.wc && save.wc.winner) cupMsg += '  World Cup: ' + save.wc.winner + '.';

  // player development, aging, contracts, youth academy
  var growth = applyGrowth();
  var leavers = [];
  save.squad.forEach(function (p) { p.contract--; });
  save.squad = save.squad.filter(function (p) {
    if (p.contract <= 0) { leavers.push(p.name); return false; }
    return true;
  });
  var grads = youthIntake();
  var usedY = usedNamesFromSquad();
  while (countRole('GK') < 1) { var g = genPlayer('GK', 62, usedY); g.contract = 3; save.squad.push(g); }
  while (save.squad.length < 13) { var y = genPlayer(pick(['DF', 'MF', 'FW']), 62, usedY); y.contract = 3; save.squad.push(y); }
  assignNumbers(save.squad);

  var summary = 'Finished ' + (posIdx + 1) + ordinal(posIdx + 1) + ' — prize ' + fmtM(prize) + '.' + champMsg + moveMsg + cupMsg +
    (growth.grew.length ? '  📈 Improved: ' + growth.grew.slice(0, 4).join(', ') + '.' : '') +
    (growth.declined.length ? '  📉 Declined: ' + growth.declined.slice(0, 3).join(', ') + '.' : '') +
    (grads.length ? '  🎓 Academy graduates: ' + grads.join('; ') + '.' : '') +
    (leavers.length ? '  Contracts ended: ' + leavers.join(', ') + '.' : '');
  save.season++;
  startSeasonState(save);
  persist();
  showMessage('SEASON ' + (save.season - 1) + ' COMPLETE', summary + '   (press 6 to start season ' + save.season + ')', 9999);
}
function ordinal(n) { return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'; }

function startNextMatch() {
  toggleLeaguePanel(false);
  pendingRestart = null;
  pendingSendOff = null;
  cancelCharge();
  hideStatsPanel();
  endTrophyScene();
  match.half = 1;
  match.clock = 0;
  match.recorded = false;
  match.subsUsed = 0;
  match.stoppages = 0;
  match.injSet = false;
  match.injReal = 0;
  match.celebrate = null;
  match.stats = freshStats();
  match.scorerCounts = {};
  sayParts([
    { t: 'Good ' + (weather.night ? 'evening' : 'afternoon') + ', and welcome to Meridian Park' +
         (weather.rain ? ', where the rain is sweeping across the pitch' : (weather.night ? ', under the floodlights' : '')) + '.', e: 'calm' },
    { t: fixtureTitle(match.fixture) + '. ' + home.name + ' take on ' + away.name + '.', e: 'build' },
    { t: 'And we are underway!', e: 'excited' }
  ], 2);
  setupMatch();
  resetToFormation(home);
  beginFreeze(1.6, 'play', match.fixture.type === 'cup' ? 'CUP TIE' : 'KICK OFF',
    fixtureTitle(match.fixture) + ' — ' + home.name + ' vs ' + away.name + ' · ' + weatherLabel());
}

function updateMatch(dt) {
  if (menuOpen) return;          // the world stops completely while you manage
  if (match.state === 'play') {
    if (!trainingMode) match.clock += dt;
    if (match.clock >= HALF_REAL_SECONDS && !match.injSet) {
      // added time based on stoppages this half
      match.injSet = true;
      var injMin = clamp(1 + Math.floor(match.stoppages / 3), 1, 5);
      match.injReal = injMin * (HALF_REAL_SECONDS / 45);
      showMessage('+' + injMin + ' MIN', 'added time', 2);
      say('The board goes up: ' + injMin + ' added minute' + (injMin === 1 ? '' : 's') + '.', 2, 'tense');
    }
    if (match.clock >= HALF_REAL_SECONDS + match.injReal) {
      if (match.half === 1) {
        match.state = 'halftime';
        whistle(2);
        say('That is half time. ' + home.name + ' ' + home.score + ', ' + away.name + ' ' + away.score + '.', 3, 'calm');
        renderStatsPanel('HALF TIME');
        showMessage('HALF TIME', home.name + ' ' + home.score + ' – ' + away.score + ' ' + away.name + '   (any key to continue)', 9999);
      } else {
        finishMatch();
      }
      return;
    }
  } else if (match.state === 'freeze') {
    match.freezeTimer -= dt;
    if (match.freezeTimer <= 0) {
      if (match.afterFreeze === 'play') match.state = 'play';
      else if (match.afterFreeze === 'do-restart' && pendingRestart) {
        var r = pendingRestart;
        pendingRestart = null;
        executeRestart(r);
      }
      else if (match.afterFreeze === 'kickoff-home') { resetToFormation(home); beginFreeze(1.2, 'play', '', ''); }
      else if (match.afterFreeze === 'kickoff-away') { resetToFormation(away); beginFreeze(1.2, 'play', '', ''); }
    }
  } else if (match.state === 'halftime') {
    if (Object.keys(justPressed).length > 0 && !menuOpen) {
      match.half = 2;
      match.clock = 0;
      match.injSet = false;
      match.injReal = 0;
      match.stoppages = 0;
      hideStatsPanel();
      teams.forEach(function (t) { t.attackDir *= -1; });
      resetToFormation(away);
      beginFreeze(1.4, 'play', 'SECOND HALF', away.name + ' kick off');
      commentate('kickoff');
    }
  } else if (match.state === 'fulltime') {
    if ((justPressed['KeyR'] || justPressed['Digit6'] || justPressed['Numpad6']) && !menuOpen) {
      if (save.md >= SEASON_MDS && !save.cupPending && !save.cwcPending && !save.wcPending && !match.seasonHandled) {
        if (nextPostSeasonStep()) {
          startNextMatch();
        } else {
          match.seasonHandled = true;
          toggleLeaguePanel(false);
          endSeason();
        }
      } else {
        match.seasonHandled = false;
        startNextMatch();
      }
    }
  }
}

// ---------- HUD ----------
function updateHUD(dt) {
  el.clock.textContent = displayClock() + (match.half === 2 ? '  2H' : '  1H') +
    (match.fixture && match.fixture.type === 'cup' ? ' 🏆' : '');
  if (controlledPlayer) {
    el.pName.textContent = controlledPlayer.name;
    el.pNum.textContent = '#' + controlledPlayer.num;
    el.pMeta.textContent = controlledPlayer.data.ovr + ' OVR · ' + controlledPlayer.style +
      ' · ' + (controlledPlayer.matchRating || 6).toFixed(1);
    el.stamina.style.width = controlledPlayer.stamina + '%';
    el.stamina.style.background = controlledPlayer.stamina > 40 ?
      'linear-gradient(90deg,#66bb6a,#9ccc65)' : 'linear-gradient(90deg,#ef5350,#ff8a65)';
  }
  el.power.style.width = (chargingP ? Math.round(shotCharge * 100) : 0) + '%';
  el.simButton.style.display = (match.state === 'fulltime' || menuOpen) ? 'none' : 'block';
  el.simButton.textContent = trainingMode ? '✕ EXIT TRAINING' : '⚡ SIM MATCH';
  if (msgTimer > 0) {
    msgTimer -= dt;
    if (msgTimer <= 0 && match.state !== 'halftime' && match.state !== 'fulltime') {
      el.message.style.opacity = 0;
      el.submessage.style.opacity = 0;
    }
  }
  if (justPressed['KeyH']) {
    el.controls.style.display = el.controls.style.display === 'none' ? 'block' : 'none';
  }
  if (justPressed['KeyN'] && !menuOpen) {
    voiceEnabled = !voiceEnabled;
    save.voiceOff = !voiceEnabled;
    persist();
    if (!voiceEnabled && window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    showMessage(voiceEnabled ? '🎙 COMMENTARY ON' : '🔇 COMMENTARY OFF', 'press N to toggle the voice', 1.6);
  }
  if (justPressed['KeyV'] && !menuOpen) {
    save.camera = ((save.camera || 0) + 1) % CAMERA_NAMES.length;
    persist();
    showMessage('📹 ' + CAMERA_NAMES[save.camera].toUpperCase(), 'camera changed (V to cycle)', 1.5);
  }
  if (justPressed['KeyT'] && !menuOpen) { hideStatsPanel(); toggleLeaguePanel(); }
  if (justPressed['KeyM']) { if (menuOpen) closeMenu(); else openMenu(); }
  if (justPressed['Escape'] && menuOpen) closeMenu();
  if (justPressed['KeyP'] && !menuOpen && (match.state === 'play' || match.paused)) {
    match.paused = !match.paused;
    if (match.paused) showMessage('PAUSED', 'press P to resume', 9999);
    else { el.message.style.opacity = 0; el.submessage.style.opacity = 0; }
  }
}

function updateCrowd(dt) {
  if (!crowdGain) return;
  crowdExcite = Math.max(0, crowdExcite - dt * 0.35);
  var base = 0.045 + (match.state === 'play' ? 0.015 : 0);
  crowdGain.gain.value = base + crowdExcite * 0.22;
}

// ---------- Boot ----------
setupMatch();
resetToFormation(home);
beginFreeze(1.6, 'play', match.fixture.type === 'cup' ? 'CUP TIE' : 'KICK OFF',
  fixtureTitle(match.fixture) + ' — ' + home.name + ' vs ' + away.name + ' · ' + weatherLabel());
el.startTitle.innerHTML = 'HARDY FC <span class="vs">vs</span> ' + away.name.toUpperCase();
el.startSub.textContent = fixtureTitle(match.fixture) + ' — Season ' + save.season + ' · Budget ' + fmtM(save.budget) +
  (storageOK ? '' : '  ·  ⚠ this browser cannot save progress — try Google Chrome');
console.log('[Hardy FC] season ' + save.season + ', division ' + save.division + ', matchday ' + (save.md + 1) + ', budget ' + fmtM(save.budget) + ', saving ' + (storageOK ? 'ON' : 'OFF'));

// 🎁 one-time Newbie Pack welcome
if (!save.packShown) {
  save.packShown = true;
  persist();
  setTimeout(function () {
    showMessage('🎁 NEWBIE PACK', 'Welcome, manager! £300M in the bank — build your dream squad in the TRANSFERS tab (press M)', 6);
  }, 2200);
}

// ---------- Training mode (free practice) ----------
var trainingMode = false;
function enterTraining() {
  startAudio();
  hideStartOverlay();
  trainingMode = true;
  away.players.slice().forEach(function (p) { if (p.role !== 'GK') sendOff(p); });
  match.state = 'play';
  match.clock = 0;
  pendingRestart = null;
  ball.carrier = null;
  ball.pos.set(-8, BALL_R, 0);
  ball.vel.set(0, 0, 0);
  el.scoreHome.textContent = '–';
  el.scoreAway.textContent = '–';
  showMessage('🏋 TRAINING', 'Free practice — dribble, shoot, try skill moves. The EXIT button (top right) returns to your career.', 5);
}
document.getElementById('btn-play').addEventListener('click', function () { startAudio(); hideStartOverlay(); });
document.getElementById('btn-training').addEventListener('click', enterTraining);

// debug/test hooks: open menu with #menu, league table with #table
if (location.hash === '#menu') setTimeout(function () { openMenu('squad'); }, 400);
if (location.hash === '#table') setTimeout(function () { toggleLeaguePanel(true); }, 400);
if (location.hash === '#builder') setTimeout(function () {
  builderState = { role: 'FW', name: 'Testman', stats: { pace: 60, shoot: 70, pass: 45, def: 40, phys: 50 }, pool: 55 };
  openMenu('club');
}, 400);

// ---------- Main loop ----------
var last = performance.now();
var perf = 0;
function frame(now) {
  requestAnimationFrame(frame);
  var dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  perf = now / 1000;

  pollGamepad();
  updateTouchContext();
  updateJumbotron(dt);
  updateHUD(dt);
  updateMatch(dt);
  updateCrowd(dt);
  updateAimLine();
  updateCommentary(dt);
  updateMinimap();
  updateRain(dt);

  var frozen = match.state !== 'play';
  if (!match.paused && !menuOpen) {
    if (!frozen) {
      aiTick -= dt;
      if (aiTick <= 0) { aiTick = 0.15; assignPressers(); }
      updateUser(dt);
      allPlayers().forEach(function (p) {
        if (p !== controlledPlayer) aiMovement(p, dt);
      });
      separatePlayers();
      updatePossession();
      updateBall(dt);
      updateReferee(dt, false);
      recordReplayFrame();
      // possession clock
      var possTeam = ball.carrier ? ball.carrier.team : ball.lastTouchTeam;
      if (possTeam && match.stats) statsFor(possTeam).poss += dt;
    } else {
      // trophy scene > instant replay > goal celebration
      var trophyActive = updateTrophyScene(dt);
      var replayActive = trophyActive ? false : updateReplay();
      // goal celebration: scorer sprints away, arms aloft, teammates chase him
      var celebrated = [];
      if (!replayActive && !trophyActive && match.celebrate && match.celebrate.t > 0) {
        var cel = match.celebrate;
        cel.t -= dt;
        var sc = cel.p;
        if (sc && sc.team) {
          var dirC = new THREE.Vector3(cel.tx - sc.pos.x, 0, cel.tz - sc.pos.z);
          if (dirC.lengthSq() > 4) dirC.normalize(); else dirC.set(0, 0, 0);
          if (cel.style === 'knee' && cel.t < 1.7) sc.slideTimer = Math.max(sc.slideTimer, 0.25);  // knee slide!
          movePlayer(sc, dirC, true, dt);
          sc.human.armL.rotation.x = -2.9;
          sc.human.armR.rotation.x = -2.9;
          celebrated.push(sc);
          sc.team.players.filter(function (m) { return m !== sc; })
            .sort(function (a, b) {
              return dist2d(a.pos.x, a.pos.z, sc.pos.x, sc.pos.z) - dist2d(b.pos.x, b.pos.z, sc.pos.x, sc.pos.z);
            }).slice(0, 2).forEach(function (m) {
              var dm = new THREE.Vector3(sc.pos.x - m.pos.x, 0, sc.pos.z - m.pos.z);
              if (dm.lengthSq() > 4) dm.normalize(); else dm.set(0, 0, 0);
              movePlayer(m, dm, true, dt);
              m.human.armL.rotation.x = -2.9;
              m.human.armR.rotation.x = -2.9;
              celebrated.push(m);
            });
        }
        if (cel.t <= 0) match.celebrate = null;
      }
      if (!replayActive && !trophyActive) {
        allPlayers().forEach(function (p) {
          if (celebrated.indexOf(p) < 0) p.mesh.position.set(p.pos.x, 0, p.pos.z);
        });
        ballMesh.position.copy(ball.pos);
      }
      updateReferee(dt, true);
    }
  }

  if (controlledPlayer) {
    ring.position.set(controlledPlayer.pos.x, 0.03, controlledPlayer.pos.z);
    marker.position.set(controlledPlayer.pos.x, 2.15 + Math.sin(perf * 4) * 0.06, controlledPlayer.pos.z);
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  justPressed = {};
}
requestAnimationFrame(frame);

})();
