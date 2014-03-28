function interpolate(y0, y, y1, x0, x, x1, k1, k2) {
	var dt = (x - x0) / (x1 - x0);
	var a = 0.25 + dt * 0.5;
	var k = k1 * dt + k2 * (1-dt);
	return y + (y1 - y) * a * a * a * a * a * k + (y1 - y0) * 0.01 * (1-k);
}

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

function Animation(node) {
	node.update = function(node) {
		var f = node.f;
		var n = node.n;
		if (!f || !n || node.tmp.t > f.time) {
			if (node.f) {
				node.f.x = node.tmp.x;
				node.f.y = node.tmp.y;
				node.f.zx = node.tmp.zx;
				node.f.zy = node.tmp.zy;
				node.f.r = node.tmp.r;
				node.f.a = node.tmp.a;
			}
			node.f = node.n;
			if (!node.f) node.f = node.child;
			node.n = node.f.next;
			if (!node.n) {
				node.f = node.child;
				node.n = node.f.next;
			}
			node.tmp.t = 0;
			if (!node.f.time) node.f.time = node.frameTime;
			Tree2d.select(node.f);
			if (node.f) {
				node.tmp.x = node.f.x;
				node.tmp.y = node.f.y;
				node.tmp.zx = node.f.zx;
				node.tmp.zy = node.f.zy;
				node.tmp.r = node.f.r;
				node.tmp.a = node.f.a;
				node.f.x = 0;
				node.f.y = 0;
				node.f.zx = 1;
				node.f.zy = 1;
				node.f.r = 0;
				node.f.a = 1;
			}
		} else {
			f = node.tmp;
			var dt = node.tmp.t / node.f.time;
			node.x = f.x + (n.x - f.x) * dt;
			node.y = f.y + (n.y - f.y) * dt;
			node.zx = f.zx + (n.zx - f.zx) * dt;
			node.zy = f.zy + (n.zy - f.zy) * dt;
			node.r = interpolateDegrees(f.r, n.r, dt);
			node.a = f.a + (n.y - f.a) * dt;
			node.tmp.t += node.speed;
		}
	}
	node.tmp = {t:0, x:0, y:0, r:0, zx:1, zy:1, a:1};
}
