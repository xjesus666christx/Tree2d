function interpolateDegrees(start, end, amount) {
	var difference = Math.abs(end - start);
	if (difference > 180) {
		if (end > start) {
			start += 360;
		} else {
			end += 360;
		}
	}
	
	return (start + ((end - start) * amount));
}

function setupCN(node) {
	var i = 0;
	for (key in node.c) {
		if (i == 0) node.f = node.c[key];
		else if (i == 1) node.n = node.c[key];
		else break;
		i++;
	}
	node.tmp.x = node.f.x;
	node.tmp.y = node.f.y;
}

function stepCN(node) {
	node.f = node.n;
	//node.tmp.x = node.f.x;
	//node.tmp.y = node.f.y;
	var found = false;
	for (key in node.c) {
		if (node.n == node.c[key]) {
			found = true;
		} else if (found) {
			node.n = node.c[key];
			return;
		}
	}
	setupCN(node);
}

function interpolate(y0, y, y1, x0, x, x1, k1, k2) {
	var dt = (x - x0) / (x1 - x0);
	var a = 0.25 + dt * 0.5;
	var k = k1 * dt + k2 * (1-dt);
	return y + (y1 - y) * a * a * a * a * a * k + (y1 - y0) * 0.01 * (1-k);
}

function updateAnimation(node) {
	var f = node.f;
	var n = node.n;
	if (!f || !n) {
		setupCN(node);
		if (!node.f.time) node.f.time = node.frameTime;
	} else if (node.tmp.t > f.time) {
		node.tmp.t = 0;
		stepCN(node);
		if (!node.f.time) node.f.time = node.frameTime;
	} else {
		var dt = node.tmp.t / node.f.time;
		node.tmp.x = f.x + (n.x - f.x) * dt;
		node.tmp.y = f.y + (n.y - f.y) * dt;
		node.tmp.zx = f.zx + (n.zx - f.zx) * dt;
		node.tmp.zy = f.zy + (n.zy - f.zy) * dt;
		node.tmp.a = f.a + (n.a - f.a) * dt;
		node.tmp.r = interpolateDegrees(f.r, n.r, dt);
		node.tmp.t += node.speed;
	}
}

function drawAnimation(node) {
	ctx.translate(node.x, node.y);
	var r = node.r * Math.PI / 180
	ctx.rotate(r);
	ctx.scale(node.zx, node.zy);
	var c = currentAlpha;
	currentAlpha *= node.a;
	
	var val = node.f;
	var vx = val.x;
	var vy = val.y;
	var vzx = val.zx;
	var vzy = val.zy;
	var vr = val.r;
	var va = val.a;
	val.x = node.tmp.x;
	val.y = node.tmp.y;
	val.r = node.tmp.r;
	val.zx = node.tmp.zx;
	val.zy = node.tmp.zy;
	val.a = node.tmp.a;
	if (val.draw) val.draw(val);
	else draw(val);
	val.x = vx;
	val.y = vy;
	val.r = vr;
	val.zx = vzx;
	val.zy = vzy;
	val.a = va;
	
	currentAlpha = c;
	currentAlpha = c;
	ctx.scale(1.0 / node.zx, 1.0 / node.zy);
	ctx.rotate(-r);
	ctx.translate(-node.x, -node.y);
}

function Animation(node) {
	node.update = updateAnimation;
	node.tmp = {x:0,y:0,r:0,zx:1,zy:1,a:1,t:0,rr:0,s:0};
}