let c = $('#canvas').get(0);
let ctx = c.getContext('2d');

function isBetweenOrdered(val, lowerBound, upperBound ) {
  return lowerBound <= val && val <= upperBound;
}

function overlaps(min0, max0, min1, max1 ) {
  return isBetweenOrdered( min1, min0, max0 ) || isBetweenOrdered( min0, min1, max1 );
}

function SATtest(points, axis) {
	var r = glm.vec2(1e100, -1e100);
	for(var i = 0; i < points.length; i++) {
		var d = glm.dot(points[i], axis);
		r.x = glm.min(r.x, d);
		r.y = glm.max(r.y, d);
	}

	return r;
}

class OBB {
	constructor(pos, scale, angle = 0) {
		this.pos = pos;
		this.scale = scale;
		this.angle = angle;
	}
	
	getModel() {
		return glm.scale(glm.rotate(glm.translate(glm.mat4(1), glm.vec3(this.pos, 0)), this.angle, glm.vec3(0,0,1)), glm.vec3(this.scale, 1));
	}
	
	getPoints() {
		var points = new Array(4);
		var model = this.getModel();
		points[0] = glm.vec2(model.mul(glm.vec4(-0.5, -0.5, 0, 1)));
		points[1] = glm.vec2(model.mul(glm.vec4(0.5, -0.5, 0, 1)));
		points[2] = glm.vec2(model.mul(glm.vec4(-0.5, 0.5, 0, 1)));
		points[3] = glm.vec2(model.mul(glm.vec4(0.5, 0.5, 0, 1)));
		return points;
	}
	
	draw(alpha = 1) {
		ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
		
		var points = this.getPoints();
		for(var i = 0; i < points.length; i++) {
			ctx.beginPath();
			ctx.arc(points[i].x, points[i].y, 2, 0, 2*Math.PI);
			ctx.fill();
		}

		ctx.save();
		ctx.translate(this.pos.x, this.pos.y);
		ctx.rotate(this.angle);
		
		ctx.lineWidth = 1.5;
		
		ctx.beginPath();
		ctx.moveTo(0,0);
		ctx.lineTo(this.scale.x, 0);
		ctx.strokeStyle = 'rgba(255, 0, 0, ' + alpha + ')';
		ctx.stroke();
		ctx.closePath();
		
		ctx.beginPath();
		ctx.moveTo(0,0);
		ctx.lineTo(0, this.scale.y);
		ctx.strokeStyle = 'rgba(0, 255, 0, ' + alpha + ')';
		ctx.stroke();
		ctx.closePath();
		
		ctx.beginPath();
		ctx.strokeStyle = 'rgba(180, 180, 180, ' + alpha + ')';
		ctx.rect(-this.scale.x * 0.5, -this.scale.y * 0.5, this.scale.x,  this.scale.y);
		ctx.stroke();
		ctx.closePath();
		
		ctx.restore();
	}
	
	intersect(other) {
		// SAT based 4 axis OBB vs OBB collider
		const x0 = glm.vec2(Math.sin(this.angle), Math.cos(this.angle));
        const y0 = glm.vec2(-x0.y, x0.x);
        const x1 = glm.vec2(Math.sin(other.angle), Math.cos(other.angle));
        const y1 = glm.vec2(-x1.y, x1.x);
		
		let axies = [x0, y0, x1, y1];

		// Project points on each axis to find overlaps
		for(let i = 0; i < axies.length; i++) {
            let r0 = SATtest(this.getPoints(), axies[i]);
            let r1 = SATtest(other.getPoints(), axies[i]);
			if(!overlaps(r0.x, r0.y, r1.x, r1.y)) return false;
		}
		return true;
	}
}

var enabledDebug = false;

class Food extends OBB {
	constructor(pos, scale, angle) {
		super(pos, scale, angle);
	}
	
	draw() {
		ctx.save();
		ctx.translate(this.pos.x, this.pos.y);
		ctx.rotate(this.angle);
		
		ctx.fillStyle = 'rgb(220, 60, 60)';
		ctx.fillRect(-this.scale.x * 0.5, -this.scale.y * 0.5, this.scale.x,  this.scale.y);
		
		ctx.restore();
		
		if(enabledDebug) super.draw();
	}
}

class Particle {
	constructor(pos, vel, radius, lifeTime) {
		this.pos = pos;
		this.vel = vel;
		this.radius = radius;
		this.lifeTime = lifeTime;
		this.countdown = lifeTime;
	}
	
	update(dt) {
		this.countdown -= dt;
		this.pos.add_eq(this.vel.mul(dt));
	}
	
	draw() {
		let alpha = Math.pow(glm.clamp(this.countdown / this.lifeTime, 0, 1), .25);
		ctx.fillStyle = 'rgba(180, 220, 160, ' + alpha.toString() + ')';
		//console.log(ctx.fillStyle);
		ctx.beginPath();
		ctx.arc(this.pos.x, this.pos.y, this.radius, 0, 2*Math.PI);
		ctx.fill();
		ctx.closePath();
	}
}

const maxWidth = 24;

class IKJoint {
	getOBB() {
		return new OBB(this.p.add(glm.vec2(Math.cos(this.angle), Math.sin(this.angle)).mul(this.parent == null ? this.length/2 + this.w/4: this.length/2)),
			glm.vec2(this.parent == null ? this.length/2 + this.w: this.length, this.w), this.angle);
	}

    constructor(p, angle, length, w, parent = null) {
        this.p = p;
        this.w = w;
        this.parent = parent;
        this.angle = angle;
        this.length = length;
		if(parent != null) {
			this.depth = this.parent.depth + 1;
		} else {
			this.depth = 0;
		}
		this.bounds = this.getOBB();
    }

    draw() {
        ctx.strokeStyle = 'rgb(85, 120, 40)';
        ctx.lineCap = 'round';
        ctx.lineWidth = this.w;

        ctx.beginPath();
        ctx.moveTo(this.p.x, this.p.y);
		var p1 = this.get_p1();
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
    }

	grow() {
		let dir = glm.vec2(-Math.cos(this.angle), -Math.sin(this.angle)).mul(this.length * 2);
    	return new IKJoint(this.p.add(dir), 0, maxWidth, glm.max(maxWidth / Math.pow(this.depth + 2, .4), 6), this);
	}

    get_p1() { return this.p.add(glm.vec2(Math.cos(this.angle), Math.sin(this.angle)).mul(this.length)); }

    update(p) {
		let v = p.sub(this.p);
        this.angle = Math.atan2(v.y, v.x);

        let l = glm.length(v) - this.length;
        let d = glm.normalize(v);

        this.p.add_eq(d.mul(l));
		//this.p = glm.vec2(this.p.x % c.width, this.p.y % c.height);

		this.bounds = this.getOBB();
    }
}

let joints = [];
let dead = [];

function addParticles(pos, n) {
	for(let i = 0; i < n; i++) {
		let a = Math.random() * 2*Math.PI;
		let vel = glm.vec2(Math.sin(a), Math.cos(a)).mul(Math.random()*100);
		particles.push(new Particle(glm.vec2().copy(pos), vel, 2 + 3 * Math.random(), 1));
	}
}

let p = glm.vec2(c.width/2, c.height/2);
let needFood = 3;
let food = [];
let particles = [];

function addFood() {
	food.push(new Food(glm.vec2(Math.random() * c.width, Math.random() * c.height),
		glm.vec2(16), Math.random() * 2*Math.PI));
}

function addJoint() {
	joints.push(new IKJoint(glm.vec2(c.width/2, c.height/2), 0, maxWidth, maxWidth));
}

addFood();
addJoint();

let avel = 0;
let vel = 0;

let keys = new Array(256);

window.onkeydown = (e) => {
	switch(e.keyCode) {
		case 82: // R
            joints = [];
            dead = [];
			particles = [];
            addJoint();
            break;
		case 118: // F7
			enabledDebug = !enabledDebug;

	}
	
	keys[e.keyCode] = true;
};

window.onkeyup = (e) => {
	keys[e.keyCode] = false;
};

let time, lastTime;
let deltaTime = 0;
time = window.performance.now();

setInterval(() => {
	
	lastTime = time;
	time = window.performance.now();
	deltaTime = (time - lastTime) / 1000;
	
	ctx.clearRect(0, 0, c.width, c.height);

	if(keys[65]) { // A
		avel -= glm.radians(5) * deltaTime;
	}
	if(keys[68]) { // D
		avel += glm.radians(5) * deltaTime;
	}
	if(keys[87]) { // W
		vel += 10 * deltaTime;	
	}
	if(keys[83]) { // S
		vel -= 10 * deltaTime;
	}
	
	avel = glm.clamp(avel, glm.radians(-10), glm.radians(10));
	vel = glm.clamp(vel, 0, 3);

	for(let i = 1; i < needFood; i++) {
		addFood();
		needFood--;
	}

	for(let i = food.length-1; i >= 0; i--) {
		food[i].draw();
		if(food[i].intersect(joints[0].bounds)) {
			addParticles(food[i].pos, 25);
			console.log(particles.length);
			joints.push(joints[joints.length-1].grow());
			food.splice(i, 1);
			needFood++;
		}
	}

	let length = 0;
	let idx;
	for(idx = 1; idx < joints.length && length < joints[0].bounds.scale.x; idx++) {
        length += joints[idx].bounds.scale.x;
	}

	for(let i = idx+1; i < joints.length; i++) {
		if(joints[0].bounds.intersect(joints[i].bounds)) {
			dead = dead.concat(joints.splice(i, joints.length-i));
			console.log(dead);
				break;
		}
	}
/*
    for(let i = 0; i < dead.length; i++) {
        dead[i].draw();
    }
*/
	for(let i = 0; i < particles.length; i++) {
		particles[i].update(deltaTime);
		particles[i].draw();
	}
	
	console.log('vel:', vel);
	console.log('avel:', avel);

	avel -= glm.sign(avel) * glm.radians(3) * deltaTime;
	vel -= glm.sign(vel) * 5 * deltaTime;
	//joints[0].angle = Math.atan2(d.y, d.x);
	joints[0].angle += avel;
	let p1 = joints[0].get_p1();
	let dir = glm.normalize(p1.sub(joints[0].p));	
	p = p1.add(dir.mul(vel));
	p.x = glm.clamp(p.x, 0, c.width);
	p.y = glm.clamp(p.y, 0, c.height);
	for(let i = 0; i < joints.length; i++) {
		joints[i].update(i == 0 ? p : joints[i].parent.p);
		joints[i].draw();
	}

	fontSize = 14;
	ctx.font = fontSize + 'px Arial';
	ctx.fillStyle = 'rgba(200, 200, 0, 1)';
	ctx.fillText('Press F7 for debug', 4, fontSize);
	ctx.fillText('Length ' + joints.length, 4, 2*fontSize + 4);
	
	if(enabledDebug) {
		for(let i = 0; i < joints.length; i++) {
		    joints[i].bounds.draw(1/(0.25*(joints[i].depth + 1)));
		}
	}

}, 10);
