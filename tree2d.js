(function() {

function Tree2d(container, root, editorContainer) {
	if (!(this instanceof Tree2d)) {
		throw new Error('Tree2d constructor called without "new".');
	}
	
	if (!(container instanceof HTMLCanvasElement)) {
		throw new Error('Tree2d container is not a canvas.');
	}
	
	this.events = {
		init: {
			begin: '',
			end: ''
		},
		boxCollision: {
			begin: '\nif (t.boxCollision(n)) {\n',
			end: '\n}'
		},
		update: {
			begin: '',
			end: ''
		},
		click: {
			begin: '\nif (t.clicked === n || (t.keys && t.keys[n.key])) {\n',
			end: '\nt.clicked=undefined;}'
		}
	};
	
	this.cid = 1; // текущий айдишник
	this.canvas = container;
	this.ctx = container.getContext("2d");
	this.ctx.fillStyle = 'black';
	this.ctx.font = "bold 20px Arial";
	
	if (typeof root === 'string') root = JSON.parse(root);
	root = root || {x:0, y:0, r:0, zx:1, zy:1, a:1};
	this.root = root;
	this.init(root);
	this.canvas.width = root.w;
	this.canvas.height = root.h;
	
	var self = this;
	this.canvas.addEventListener('mousedown', function(evt) {self.click(evt)}, false);
	this.canvas.addEventListener('mousemove', function(evt) {self.drag(evt)}, false);
	this.canvas.addEventListener('mouseup',   function(evt) {self.release(evt)}, false);
	this.canvas.addEventListener('mouseout',  function(evt) {self.release(evt)}, false);
	this.canvas.addEventListener('touchstart', function(evt) {self.click(evt)}, false);
	this.canvas.addEventListener('touchmove', function(evt) {self.drag(evt)}, false);
	this.canvas.addEventListener('touchend',   function(evt) {self.release(evt)}, false);
	this.canvas.addEventListener('touchleave',   function(evt) {self.release(evt)}, false);
	this.canvas.addEventListener('touchcancel',   function(evt) {self.release(evt)}, false);
	
	if (editorContainer) {
		this.createEditorFeatures(editorContainer);
	}
};

Tree2d.prototype.images = {};

// действия за 1 кадр: отрисовка и апдейт
Tree2d.prototype.cycle = function() {
	var n = this.root;
	var ctx = this.ctx;
	
	ctx.save();
	ctx.fillRect(0, 0, this.root.w, this.root.h);
	ctx.translate(this.root.w / 2, this.root.h / 2);
	
	while (n) {
		ctx.save();
		ctx.globalAlpha *= n.a;
		ctx.translate(n.x, n.y);
		ctx.rotate(n.r / 180 * Math.PI);
		ctx.scale(n.zx, n.zy);
	
		if (n.a && n.drawCB) n.drawCB(n, ctx);
		if (n.a && n.child) {
			n = n.child;
		} else {
			while (n) {
				ctx.restore();
				if (n.next) {
					n = n.next;
					break;
				}
				n = n.parent;
			}
		}
	}
	
	n = this.root;
	while (n) {
		if (n.a && n.a <= 1 && n.updateCB) {
			try {
				n.updateCB(n, this);
			} catch (e) {
				var p = n.parent, i;
				for (i in n.parent) if (n === p[i]) break;
				console.log('Error in "'+i+'" update');
				console.log(n.updateCB);
				this.changeEditMode('off');
			}
		}
		if (n.a && n.a <= 1 && n.child) {
			n = n.child;
		} else {
			while (n) {
				if (n.next) {
					n = n.next;
					break;
				}
				n = n.parent;
			}
		}
	}
	
	ctx.restore();
	
	this.mousedown = undefined;
	this.mousemove = undefined;
	this.mouseup = undefined;
	this.keys = undefined;
};

// генерирует уникальный айдишник - имя узла
Tree2d.prototype.genId = function() {
	return this.cid++;
};

// определяет, ивент или нет, по имени
Tree2d.prototype.isEventName = function(name) {
	for (var i in this.events) if (name === i) return true;
	return false;
};

// определяет, нода или нет, по имени
Tree2d.prototype.isNodeName = function(name) {
	if (name === 'initCB') return false;
	if (name === 'updateCB') return false;
	if (name === 'drawCB') return false;
	if (name === 'src') return false;
	if (name === 'data') return false;
	if (name === 'parent') return false;
	if (name === 'child') return false;
	if (name === 'next') return false;
	if (this.isEventName(name)) return false;
	return true;
};

// возвращает копию указанного узла
// рекурсивная
Tree2d.prototype.copy = function(obj, holdIDs) {
	var c = {};
	for (var i in obj) {
		if (i === 'id' && !holdIDs) {
			c[i] = this.genId();
		} else if (typeof obj[i] === 'number' || typeof obj[i] === 'string') {
			c[i] = obj[i];
		}
	}
	for (var i in obj) {
		if (i === 'data') {
			c[i] = obj[i];
		} else if (typeof obj[i] === 'object' && this.isNodeName(i)) {
			c[i] = this.copy(obj[i], holdIDs);
		}
	}
	return c;
};

// создает дефолтные поля, если их нет
// вызывает для каждой ноды ф-ю инициализации
// создает в узле ссылки на родителя, соседа и потомка
// рекурсивная
Tree2d.prototype.init = function(node) {
	if (!node.x) node.x = 0;
	else node.x = parseFloat(node.x);
	if (!node.y) node.y = 0;
	else node.y = parseFloat(node.y);
	if (!node.r) node.r = 0;
	else node.r = parseFloat(node.r);
	if (!node.zx) node.zx = 1;
	else node.zx = parseFloat(node.zx);
	if (!node.zy) node.zy = 1;
	else node.zy = parseFloat(node.zy);
	if (!node.w) node.w = 0;
	else node.w = parseFloat(node.w);
	if (!node.h) node.h = 0;
	else node.h = parseFloat(node.h);
	if (node.a == undefined) node.a = 1;
	else node.a = parseFloat(node.a);
	if (node.id == undefined) node.id = this.genId();
	this.cookUpdate(node);
	if (node.initCB) node.initCB(node, this);
	var prev;
	for (var i in node) if (typeof node[i] === 'object' && this.isNodeName(i)) {
		var val = node[i];
		if (!val.parent) val.parent = node;
		if (!prev) node.child = val;
		else prev.next = val;
		prev = val;
		this.init(val);
	}
};

// удаляет из узла дефолтные поля
// рекурсивная
Tree2d.prototype.clean = function(node) {
	if (node.x == 0) delete node.x;
	else node.x = Math.round(node.x);
	if (node.y == 0) delete node.y;
	else node.y = Math.round(node.y);
	if (node.r == 0) delete node.r;
	else node.r = Math.round(node.r);
	if (node.zx == 1) delete node.zx;
	if (node.zy == 1) delete node.zy;
	if (node.a == 1) delete node.a;
	if (node.w == 0) delete node.w;
	if (node.h == 0) delete node.h;
	if (node.id) delete node.id;
	for (var i in node) {
		if (typeof node[i] === 'number') {
			node[i] = parseFloat(node[i].toFixed(4));
		} else if (this.isEventName(i) || i === 'src') {
		} else if (typeof node[i] === 'object' && this.isNodeName(i)) {
			this.clean(node[i]);
		} else {
			delete node[i];
		}
	}
	return node;
};

// добавляет node в родителя
// перестраивает ссылки на следующий элемент среди потомков parent
// инициализирует node
Tree2d.prototype.add = function(parent, node, ename) {
	var name;
	if (!ename && node.parent) {
		for (var i in node.parent) {
			if (node.parent[i] === node) {
				ename = i;
				ename = ename.replace(/[0-9]+$/, '');
				break;
			}
		}
	}
	if (parent[ename]) {
		for (var j = 0; j < 99999; j++) {
			name = ename + j;
			if (parent[name] === undefined) break;
		}
	} else {
		name = ename;
	}
	
	node = this.copy(node);
	parent[name] = node;
	node.parent = parent;
	
	if (!parent.child) {
		parent.child = node;
	} else {
		var c = parent.child;
		while (c.next) c = c.next;
		c.next = node;
	}
	this.init(node);
	
	return node;
};

// удаляет node из потомков его родителя
Tree2d.prototype.del = function(node) {
	var parent = node.parent;
	if (parent) {
		for (var i in parent) {
			if (parent[i] === node) {
				delete parent[i];
			}
		}
		if (parent.child === node) {
			parent.child = node.next;
		} else {
			var c = parent.child;
			while (c.next && c.next !== node) c = c.next;
			c.next = node.next;
		}
	}
};

// делает node на слой выше соседей
// влияет на порядок отрисовки, апдейта, нахождения кликнутого узла
Tree2d.prototype.raise = function(node) {
	if (node.next) this.fall(node.next);
};

// делает node на слой ниже соседей
// влияет на порядок отрисовки, апдейта, нахождения кликнутого узла
Tree2d.prototype.fall = function(node) {
	if (!node.parent) return;
	var p = node.parent, prev = p.child, i, j;
	
	if (prev !== node) {
		while (prev.next) {
			if (prev.next === node) break;
			prev = prev.next;
		}
	
		var prevprev = p.child;
		if (prevprev !== prev) {
			while (prevprev.next) {
				if (prevprev.next === prev) break;
				prevprev = prevprev.next;
			}
			prevprev.next = node;
		} else {
			p.child = node;
		}
	
		prev.next = node.next;
		node.next = prev;
	}
};

// всем потомкам родителя node, кроме node, выставляет opacity = 0
Tree2d.prototype.select = function(node) {
	var c = node.parent.child;
	while (c) {
		if (c !== node) c.a = 0;
		else if (c.a === 0) c.a = 1;
		c = c.next;
	}
};

// возвращает node к первоначальному виду (на момент старта прилаги)
Tree2d.prototype.reset = function(node) {
	var b = this.findById(node.id, this.backup);
	var backup = this.copy(b, true);
	for (i in backup) {
		if (i !== 'next' && i !== 'parent') {
			node[i] = backup[i];
		}
	}
	this.init(node);
};

// находит корень дерева, в котором находится объект n
Tree2d.prototype.getRoot = function(n) {
	while (n.parent) n = n.parent;
	return n;
}

// если узел с ID id не найден - вернет undefined
Tree2d.prototype.findById = function(id, n) {
	n = n || this.root;
	
	while (n) {
		if (n.id === id) {
			return n;
		} else if (n.child) {
			n = n.child;
		} else {
			while (n) {
				if (n.next) {
					n = n.next;
					break;
				}
				n = n.parent;
			}
		}
	}
};

// в _name#param подставляет значение поля param из корня
// т.е. если root[level] = 10, то _player#level преобразуется в _player10
// ищется только в числе видимых
// если нод с таким именем много - вернется та, что рисуется позже
// если узел с именем name не найден - вернет undefined
Tree2d.prototype.findByName = function(name, n) {
	// TODO: cache finded nodes
	n = n || this.root;
	if (name.split('#').length > 1) {
		var arr = name.split('#');
		if (n[arr[1]]) {
			arr[1] = n[arr[1]];
			name = arr.join('');
		} else {
			return;
		}
	} else if (name.split('ROOT').length > 1) {
		var arr = name.split('ROOT');
		if (n[arr[1]]) {
			arr[1] = n[arr[1]];
			name = arr.join('');
		} else {
			return;
		}
	} else if (name === 'root') {
		return n;
	}
	
	/*for (i in n) if (typeof n[i] === 'object' && this.isNodeName(i)) {
		if (i === name) return n[i];
		var result = this.findByName(name, n[i]);
		if (result) return result;
	}*/
	var r;
	
	while (n) {
		if (n.a > 0 && typeof n[name] === 'object') r = n[name];
		if (n.a > 0 && n.child) {
			n = n.child;
		} else {
			while (n) {
				if (n.next) {
					n = n.next;
					break;
				}
				n = n.parent;
			}
		}
	}
	
	return r;
	//console.log('Node "'+name+'" not found');
	//throw new Error(name);
};

// получить позицию, поворот, скейл и непрозрачность отрисовки узла
Tree2d.prototype.getScreenTransform = function(node) {
	var trans = {x:0,y:0,zx:1,zy:1,r:0};
	var parent = node.parent;
	var x = node.x, y = node.y;
	var r = node.r;
	var zx = node.zx, zy = node.zy;

	while (parent) {
		var si = Math.sin(parent.r * Math.PI / 180);
		var co = Math.cos(parent.r * Math.PI / 180);
		trans.x = parent.x + (x*parent.zx*co - y*parent.zy*si);
		trans.y = parent.y + (x*parent.zx*si + y*parent.zy*co);
		trans.r = parent.r + r;
		trans.zx = parent.zx * zx;
		trans.zy = parent.zy * zy;

		x = trans.x;
		y = trans.y;
		r = trans.r;
		zx = trans.zx;
		zy = trans.zy;

		parent = parent.parent;
	}

	return trans;
};

// если бы точка была узлом и рисовалась бы в (pos.x, pos.y),
// то внутри node она имела бы позицию, поворот, скейл и непрозрачность,
// возвращенные этой ф-ей
Tree2d.prototype.convertPointToNodeTransform = function(node, pos) {
	var t = this.getScreenTransform(node);
	var dx = pos.x - t.x;
	var dy = pos.y - t.y;
	var d = Math.sqrt(dx * dx + dy * dy);
	var r = Math.atan2(dy, dx) / Math.PI * 180;
	var si = Math.sin((t.r-r) * Math.PI / 180);
	var co = Math.cos((t.r-r) * Math.PI / 180);
	var x = d * co;
	var y = d * si;
	return {x:x / t.zx, y:-y / t.zy};
};

// кликнут ли объект n, при клике в позиции pos
Tree2d.prototype.isObjectClicked = function(n, pos) {
	var t = this.getScreenTransform(n);
	var si = Math.sin(t.r * Math.PI / 180);
	var co = Math.cos(t.r * Math.PI / 180);
	var xp = [];
	var yp = [];
	var w = n.w / 2, h = n.w / 2;
	xp.push(t.x + t.zx * w * co - t.zy * h * si);
	yp.push(t.y + t.zx * w * si + t.zy * h * co);
	w = -w;
	xp.push(t.x + t.zx * w * co - t.zy * h * si);
	yp.push(t.y + t.zx * w * si + t.zy * h * co);
	h = -h;
	xp.push(t.x + t.zx * w * co - t.zy * h * si);
	yp.push(t.y + t.zx * w * si + t.zy * h * co);
	w = -w;
	xp.push(t.x + t.zx * w * co - t.zy * h * si);
	yp.push(t.y + t.zx * w * si + t.zy * h * co);

	if (this.pnpoly(4, xp, yp, pos.x, pos.y)) return true;
};

// тут все просто: находит кликнутый объект
// если такого нет - возвращает undefined
Tree2d.prototype.getClickedObject = function(pos) {
	var n = this.root;
	var arr = [];
	
	while (n) {
		if (n.a && n.w && n.w) arr.push(n);
			if (n.a && n.child) {
				n = n.child;
			} else {
				while (n) {
					if (n.next) {
						n = n.next;
						break;
					}
				n = n.parent;
			}
		}
	}
	
	arr = arr.reverse();
	for (var i in arr) {
		if (this.isObjectClicked(arr[i], pos)) {
			return arr[i];
		}
	}
};


// получить позицию мыши внутри canvas
Tree2d.prototype.getMousePos = function(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	var pos;
	if (evt.targetTouches) {
		pos = {
			x: evt.targetTouches[0].clientX - rect.left - canvas.width / 2,
			y: evt.targetTouches[0].clientY - rect.top - canvas.height / 2
		};
	} else {
		pos = {
			x: evt.clientX - rect.left - canvas.width / 2,
			y: evt.clientY - rect.top - canvas.height / 2
		};
	}
	return pos;
};

// генерирует JSON - структуру того, что в редакторе, и выводит в лог
Tree2d.prototype.logJSON = function() {
	if (this instanceof Tree2d) {
		var c = this.copy(this.root);
		this.clean(c);
		var json = JSON.stringify(c);
		console.log(json);
	} else {
		throw new Error('no root');
	}
};

// определяет, лежит ли точка (x, y) в полигоне с иксами вершин в xp и игреками в yp,
// с количеством вершин npol
Tree2d.prototype.pnpoly = function(npol, xp, yp, x, y) {
	var i, j, c = false;
	for (var i = 0, j = npol-1; i < npol; j = i++) {
		if ((((yp[i] <= y) && (y < yp[j])) ||
		     ((yp[j] <= y) && (y < yp[i]))) &&
		    (x < (xp[j] - xp[i]) * (y - yp[i]) / (yp[j] - yp[i]) + xp[i]))
		    c =!c;
	}
	return c;
};

// обработчик клика
Tree2d.prototype.click = function(evt) {
	var pos = this.getMousePos(this.canvas, evt);
	this.highlighted = this.clicked = this.getClickedObject(pos);
	this.mousedown = pos;
};

// движение мыши с нажатием
Tree2d.prototype.drag = function(evt) {
	var pos = this.getMousePos(this.canvas, evt);
	this.mousemove = pos;
	evt.preventDefault();
};

// отпускание мыши
Tree2d.prototype.release = function(evt) {
	var pos = this.getMousePos(this.canvas, evt);
	this.mouseup = pos;
	this.clicked = undefined;
};

// объект с именем n.src типа теперь потомок объекта n1, но на самом деле нет
Tree2d.prototype.link = function(n) {
	if (n && n.src) {
		n.drawCB = function(n, ctx) {
			var r = Tree2d.prototype.getRoot(n);
			var l = Tree2d.prototype.findByName(n.src, r);
			if (l) {
				var n = l.child, start = n;
		
				while (n) {
					ctx.save();
					ctx.globalAlpha *= n.a;
					ctx.translate(n.x, n.y);
					ctx.rotate(n.r / 180 * Math.PI);
					ctx.scale(n.zx, n.zy);
				
					if (n.a) {
						if (n.drawCB) n.drawCB(n, ctx);
					}
					if (n.a && n.child) {
						n = n.child;
					} else {
						while (n && n != start) {
							ctx.restore();
							if (n.next) {
								n = n.next;
								break;
							}
							n = n.parent;
						}
					}
					if (n === start) {
						ctx.restore();
						break;
					}
				}
			}
		}
	}
};

// инициализирует узел - спрайт
Tree2d.prototype.sprite = function(node) {
	if (!node.src) node.src = '#ffffff';
	if (node.src.charAt(0) == '#') {
		node.drawCB = function(node, ctx) {
			ctx.fillStyle = node.src;
			ctx.fillRect(-node.w / 2, -node.h / 2, node.w, node.h);
		}
	} else if (node.src && Tree2d.prototype.images[node.src]) {
		node.data = Tree2d.prototype.images[node.src];
		if (!node.w) node.w = node.data.width;
		if (!node.h) node.h = node.data.height;
		node.drawCB = function(node, ctx) {
			ctx.drawImage(node.data, -node.data.width / 2, -node.data.height / 2);
		}
	} else {
		//console.log('Sprite ' + node.src + ' not found');
	}
};

// грузит 1 картинку из 1 файла f
Tree2d.prototype.loadImg = function(f) {
	var images = Tree2d.prototype.images;
	var loadQueue = images.length;
	var reader = new FileReader();
	var self = this;
	reader.onload = function(e) {
		images[f.name] = new Image;
		images[f.name].src = e.target.result;
		loadQueue--;
		if (loadQueue < 0 && self instanceof Tree2d) {
			self.init(self.clean(self.root));
			self.debugCycle();
		}
	}
	reader.onerror = reader.onabort = function() {
		loadQueue--;
		if (loadQueue < 0 && self instanceof Tree2d) {
			self.init(self.clean(self.root));
			self.debugCycle();
		}
	}
	var result = reader.readAsDataURL(f);
};

// грузит кучу картинок из массива файлов files
Tree2d.prototype.loadImages = function(files) {
	var loadQueue = Tree2d.prototype.images.length = 0;
	for (var i = 0, f; f = files[i]; i++) {
		if (f.type == 'image/png' || f.type == 'image/jpeg' || f.type == 'image/bmp') {
			loadQueue++;
			if (this instanceof Tree2d) this.loadImg(f);
			else Tree2d.prototype.loadImg(f);
		}
	}
};

// берет строку ивента line (то поле, которое после типа ивента), и делает из нее код на JS
// автоматом преобразует 'param' в 'n.param', если в node есть поле param
// дополняет 'Tree2d.' к ф-ям Tree2d
// заменяет '_nodename.x' на 'Tree2d.findNodeByName("nodename").x'
Tree2d.prototype.makeFunction = function(node, line) {
	var alphanumetric = /^[a-z][a-z0-9]+$/i;
	var numetric = /^[0-9]+$/;
	var noan = /^\W$/;
	var toFind = {};
	line = line.split('\n').join(';');
	line = line.split('#').join('ROOT');

	var arr = line.split(/\b/);
	for (var k in arr) {
		var next = arr[parseFloat(k)+1];
		var prev = arr[parseFloat(k)-1];

		if (prev && prev == '.') continue;

		var flag = false;

		for (j in node) {
			if (arr[k] == j) {
				arr[k] = 'n.' + arr[k];
				flag = true;
			}
		}
		for (j in Tree2d.prototype) {
			if (arr[k] == j) {
				if (typeof Tree2d.prototype[j] === 'function') {
					arr[k] = 't.' + arr[k];
					flag = true;
					if (!next || (next && next != '(')) {
						arr[k] += '(n)';
						flag = true;
					}
				} else {
					arr[k] = 't.' + arr[k];
					flag = true;
				}
			}
		}

		if (alphanumetric.test(arr[k]) && !flag) {
			toFind[arr[k]] = true;
		}
	}
	line = arr.join('').split(';').join('\n');
	
	for (var i in toFind) {
		line = 'var '+i+' = t.findByName("'+i+'", t.root)\n' + line;
	}

	try {
		eval('(function(n,t){'+line+'})');
	} catch (e) {
		var text = 'Error in "'+line+'": ' + e;
		if (node.name) text = 'In node "'+node.name+'": '+text;
		throw new Error(text);
	}

	return line;
};
 
// подготавливает ф-ии update и init из ивентов узла
Tree2d.prototype.cookUpdate = function(node) {
	var str = '';
	
	for (var i in this.events) if (node[i] && i !== 'init') {
		str += this.events[i].begin;
		str += this.makeFunction(node, node[i]);
		str += this.events[i].end;
		str += ';';
	}
	
	if (str) {
		str = '(function(n,t) {\n' + str + '\n})';
		node.updateCB = eval(str);
	}

	if (node.init) {
		var str = '(function(n,t) {\n' + this.makeFunction(node, node.init) + '\n})';
		node.initCB = eval(str);
	}

	return true;
};

// проверяет AABB столкновения для объекта n среди его соседей, попутно их решает
Tree2d.prototype.boxCollision = function(n) {
	var c = n.parent.child;
	var flag = false;
	while (c) {
		if (c != n) {
			var dx = Math.abs(c.x - n.x);
			var dy = Math.abs(c.y - n.y);
			var dw = (c.w + n.w) * 0.5;
			var dh = (c.h + n.h) * 0.5;
			if (dx < dw && dy < dh) {
				if (dx > dy) {
					if (n.x < c.x) n.x = c.x - dw;
					else n.x = c.x + dw;
				} else {
					if (n.y < c.y) n.y = c.y - dh;
					else n.y = c.y + dh;
				}
				flag = true;
			}
		}
		c = c.next;
	}
	return flag;
};

Tree2d.prototype.getName = function(obj) {
	if (obj.parent) {
		for (var i in obj.parent) {
			if (obj.parent[i] === obj) {
				return i;
			}
		}
	} else {
		if (obj === this.root) {
			return 'root';
		} else {
			return 'NONAME';
		}
	}
};

Tree2d.prototype.createEditorFeatures = function(container) {
	var self = this;
	
	var topBar = document.createElement('div');
	topBar.style.background = '#def';
	//topBar.style.height = '19px';
	topBar.align = 'left';
	topBar.style.width = '100%';
	container.appendChild(topBar);
	
	var enabled = document.createElement('input');
	enabled.type = 'checkbox';
	enabled.style.float = 'left';
	topBar.appendChild(enabled);
	
	var hierarhy = document.createElement('select');
	hierarhy.id = 'hierarhy';
	hierarhy.style.position = 'absolute';
	hierarhy.style.opacity = 0.001;
	topBar.appendChild(hierarhy);
	
	var label = document.createElement('div');
	label.innerHTML = 'root:';
	label.style.marginLeft = '2px';
	topBar.appendChild(label);
	topBar.height = label.height;
	
	var info = document.createElement('div');
	info.style.background = '#eef';
	info.style.width = '99%';
	info.style.height = '400px';
	info.style.overflow = 'scroll';
	info.align = 'left';
	container.appendChild(info);
	
	var runBtn = document.createElement('input');
	runBtn.type = 'button';
	runBtn.value = 'RUN';
	runBtn.onclick = function(){self.testRun()};
	container.appendChild(runBtn);
	
	hierarhy.onchange = function() {
		label.innerHTML = this.value + ':';
		
		var arr = this.value.split('.'), n = self;
		for (var i = 0; i < arr.length; i++) {
			n = n[arr[i]];
		}
		
		self.highlighted = n;
		self.onchange();
	}
	
	this.testRun = function() {
		var text = JSON.stringify(this.clean(this.copy(this.root)));
		var tab = window.open('', 'myconsole', 'width=350,height=250,menubar=0,toolbar=1,status=0,scrollbars=1,resizable=1');
		text = '<html><head><title>Tree2d: Test Run</title><script type="text/javascript" src="tree2d.js"></script></head>'
			+'<body bgcolor=white onLoad="self.focus()">'
			+'<canvas id="mycanvas"></canvas>'
			+"<script>txt = '"+text
			+"'; \nvar tree = new Tree2d(document.getElementById('mycanvas'), txt); \nfunction render() { \ntree.cycle(); \nrequestAnimationFrame(render);} \nrender();</script>"
			+'</body></html>';
		tab.document.writeln(text);
		console.log(text);
		tab.document.close();
	};
	
	this.updateHierarhy = function() {
		while (hierarhy.firstChild) {
			hierarhy.removeChild(hierarhy.firstChild);
		}
		
		var n = this.root, d = 0, arr = [];
		while (n) {
			arr.push(this.getName(n));
			var option = document.createElement("option");
			option.value = arr.join('.');
			if (n === this.highlighted) {
				label.innerHTML = arr.join('.') + ':';
			}
			option.text = '';
			for (var i = 0; i < d; i++) option.text += '____';
			option.text += arr[d];
			hierarhy.appendChild(option);
			d++;
			
			if (n.child) {
				n = n.child;
			} else {
				while (n) {
					arr.pop();
					d--;
					if (n.next) {
						n = n.next;
						break;
					}
					n = n.parent;
				}
			}
		}
	};
	
	this.editParam = function(name, val) {
		var n = this.highlighted;
		if (!n) n = this.root;//return;
		if (typeof n[name] === 'number') {
			if (parseFloat(val) !== undefined) {
				n[name] = parseFloat(val);
				this.debugCycle();
			}
		} else {
			n[name] = val;
			this.debugCycle();
		}
	};
	
	this.deleteParam = function(i) {
		var n = this.highlighted;
		if (!n) n = this.root;//return;
		n[i] = undefined;
		delete n[i];
		this.updateInfo();
	};
	
	this.selectByPath = function(i) {
		var n = self.highlighted;
		if (!n) n = self.root;//return;
		
		var arr = i.split('.');
		for (var i = 0; i < arr.length; i++) {
			n = n[arr[i]];
		}
		
		self.highlighted = n;
		self.onchange();
	};
	
	this.addParam = function(name, type) {
		var n = self.highlighted;
		if (!n) n = self.root;
		
		if (!type || type === 'Number') {
			if (n[name]) return;
			n[name] = 0;
		} else if (type === 'String') {
			if (n[name]) return;
			n[name] = 'Some string';
		} else if (type === 'Object') {
			self.add(n, {x:0,y:0,r:0,zx:1,zy:1,a:1}, name);
		}
		self.updateInfo();
	};
	
	function expandName(name) {
		var n = '';
		for (var i = 0; i < name.length; i++) {
			if (name.charAt(i) === '_') {
				if (i > 0) {
					n += ' ';
					i++;
					n += name.charAt(i).toUpperCase();
				}
			} else {
				if (name.charAt(i) === name.charAt(i).toUpperCase()) n += ' ';
				n += name.charAt(i);
			}
		}
		n = n.charAt(0).toUpperCase() + n.substr(1);
		return n;
	}
	
	this.updateInfo = function() {
		while (info.firstChild) {
			info.removeChild(info.firstChild);
		}
		var n = this.highlighted, j = 1;
		if (!n) n = this.root;//return;
		
		enabled.checked = n.a > 0 ? true : false;
		
		var keys = document.createElement('div');
		keys.style.float = 'left';
		keys.style.width = '20%';
		keys.style.minWidth = '50px';
		info.appendChild(keys);
		var values = document.createElement('div');
		values.style.float = 'left';
		values.style.width = '80%';
		info.appendChild(values);
		
		var pos = document.createElement('div');
		pos.style.width = '100%';
		pos.innerHTML = 'Position';
		keys.appendChild(pos);
		var bounds = document.createElement('div');
		bounds.style.width = '100%';
		bounds.style.background = '#def';
		bounds.innerHTML = 'Bounds';
		keys.appendChild(bounds);
		var scale = document.createElement('div');
		scale.style.width = '100%';
		scale.innerHTML = 'Scale';
		keys.appendChild(scale);
		var rot = document.createElement('div');
		rot.style.width = '100%';
		rot.style.background = '#def';
		rot.innerHTML = 'Rotation';
		keys.appendChild(rot);
		var alpha = document.createElement('div');
		alpha.style.width = '100%';
		alpha.innerHTML = 'Opacity';
		keys.appendChild(alpha);
		
		var X = document.createElement('input');
		X.type = 'number';
		X.value = n.x;
		X.onchange = function(){self.editParam('x', this.value)};
		X.className = 'DoubleNumber';
		values.appendChild(X);
		var Y = document.createElement('input');
		Y.type = 'number';
		Y.value = n.y;
		Y.onchange = function(){self.editParam('y', this.value)};
		Y.className = 'DoubleNumber';
		values.appendChild(Y);
		var W = document.createElement('input');
		W.type = 'number';
		W.value = n.w;
		W.onchange = function(){self.editParam('w', this.value)};
		W.className = 'DoubleNumber';
		values.appendChild(W);
		var H = document.createElement('input');
		H.type = 'number';
		H.value = n.h;
		H.onchange = function(){self.editParam('h', this.value)};
		H.className = 'DoubleNumber';
		values.appendChild(H);
		var ZX = document.createElement('input');
		ZX.type = 'number';
		ZX.value = n.zx;
		ZX.onchange = function(){self.editParam('zx', this.value)};
		ZX.className = 'DoubleNumber';
		values.appendChild(ZX);
		var ZY = document.createElement('input');
		ZY.type = 'number';
		ZY.value = n.zy;
		ZY.onchange = function(){self.editParam('zy', this.value)};
		ZY.className = 'DoubleNumber';
		values.appendChild(ZY);
		var R = document.createElement('input');
		R.type = 'number';
		R.value = n.r;
		R.onchange = function(){self.editParam('r', this.value)};
		R.className = 'Number';
		values.appendChild(R);
		var A = document.createElement('input');
		A.type = 'number';
		A.className = 'DoubleNumber';
		values.appendChild(A);
		var AR = document.createElement('input');
		AR.type = 'range';
		AR.min = 0;
		AR.max = 1;
		AR.step = 0.02;
		AR.value = 1;
		AR.className = 'DoubleRange';
		values.appendChild(AR);
		A.value = AR.value = n.a;
		A.onchange = function(){self.editParam('a', this.value); AR.value = this.value; enabled.checked = n.a > 0 ? true : false};
		AR.oninput = function(){self.editParam('a', this.value); A.value = this.value; enabled.checked = n.a > 0 ? true : false};
		enabled.onchange = function(){n.a = A.value = AR.value = this.checked ? 1 : 0; self.debugCycle()};
		
		for (var i in n) {
			if (i === 'x' || i === 'y' || i === 'r' || i === 'zx' || i === 'zy' || i === 'a' || i === 'w' || i === 'h' || i === 'id' || i === 'next' || i === 'child') {
			} else if (typeof n[i] === 'number') {
				var key = document.createElement('div');
				key.style.width = '100%';
				key.style.whiteSpace = 'nowrap';
				if (j++ % 2) key.style.background = '#def';
				key.innerHTML = expandName(i);
				keys.appendChild(key);
				var val = document.createElement('input');
				val.type = 'number';
				val.value = n[i];
				val.onchange = function(){self.editParam(i, this.value)};
				val.className = 'Number';
				val.style.width = '90%';
				values.appendChild(val);
				var delBtn = document.createElement('input');
				delBtn.type = 'button';
				delBtn.value = '-';
				delBtn.id = i;
				delBtn.style.width = '9%';
				delBtn.onclick = function(){self.deleteParam(this.id)};
				values.appendChild(delBtn);
			} else if (typeof n[i] === 'string') {
				var key = document.createElement('div');
				key.style.width = '100%';
				key.style.whiteSpace = 'nowrap';
				if (j++ % 2) key.style.background = '#def';
				key.innerHTML = expandName(i);
				keys.appendChild(key);
				var val = document.createElement('input');
				val.type = 'text';
				val.spellCheck = false;
				val.style.width = '90%';
				val.value = n[i];
				val.onchange = function(){self.editParam(i, this.value)};
				val.className = 'String';
				values.appendChild(val);
				var delBtn = document.createElement('input');
				delBtn.type = 'button';
				delBtn.value = '-';
				delBtn.id = i;
				delBtn.style.width = '9%';
				delBtn.onclick = function(){self.deleteParam(this.id)};
				values.appendChild(delBtn);
			}
		}
		for (var i in n) {
			if (i === 'x' || i === 'y' || i === 'r' || i === 'zx' || i === 'zy' || i === 'a' || i === 'w' || i === 'h' || i === 'id' || i === 'next' || i === 'child') {
			} else if (typeof n[i] === 'object') {
				var name = i;
				if (i === 'parent') {
					name = this.getName(n.parent);
				} else {
					name = i;
				}
				
				var key = document.createElement('div');
				key.style.width = '100%';
				key.style.whiteSpace = 'nowrap';
				if (j++ % 2) key.style.background = '#def';
				key.innerHTML = expandName(i);
				keys.appendChild(key);
				var selectBtn = document.createElement('input');
				selectBtn.type = 'button';
				selectBtn.value = name + ' (object)';
				selectBtn.id = i;
				selectBtn.style.width = '90%';
				selectBtn.onclick = function(){self.selectByPath(this.id)};
				values.appendChild(selectBtn);
				var delBtn = document.createElement('input');
				delBtn.type = 'button';
				delBtn.value = '-';
				delBtn.id = i;
				delBtn.style.width = '9%';
				delBtn.onclick = function(){self.deleteParam(this.id)};
				values.appendChild(delBtn);
			}
		}
		
		var addLabel = document.createElement('select');
		addLabel.style.width = '100%';
		if (j++ % 2 == 0) addLabel.style.background = '#eef';
		keys.appendChild(addLabel);
		var types = ['Number', 'String', 'Object'];
		for (var i in types) {
			var option = document.createElement("option");
			option.value = option.text = types[i];
			addLabel.appendChild(option);
		}
		
		var name = document.createElement('input');
		name.type = 'text';
		name.spellCheck = false;
		name.style.width = '90%';
		name.placeholder = 'field name';
		name.className = 'String';
		name.onkeydown = function(){if (event.keyCode == 13) document.getElementById('addBtn').click()};
		values.appendChild(name);
		var addBtn = document.createElement('input');
		addBtn.type = 'button';
		addBtn.id = 'addBtn';
		addBtn.value = '+';
		addBtn.style.width = '9%';
		addBtn.onclick = function(){self.addParam(name.value, addLabel.value)};
		values.appendChild(addBtn);
	}
	
	// находит объект, относительно которого можно выровнять объект n
	this.alignObject = function(n, minh, minv) {
		var p = n.parent, c = p.child, guide = {};
		minh = minh || 20;
		minv = minv || 20;

		if (Math.abs(n.x) < minh) {
			guide.horisontal = p;
		}
		if (Math.abs(n.y) < minv) {
			guide.vertical = p;
		}

		if (!n.r) {
			if (Math.abs(-n.x - n.w / 2) < minh) {
				guide.boundleft = p;
			}
			if (Math.abs(n.x - n.w / 2) < minh) {
				guide.boundright = p;
			}
			if (Math.abs(-n.y - n.h / 2) < minv) {
				guide.boundtop = p;
			}
			if (Math.abs(n.y - n.h / 2) < minv) {
				guide.boundbottom = p;
			}
		}

		if (guide.horisontal) n.x = 0;
		else if (guide.boundleft) n.x = -n.w / 2;
		else if (guide.boundright) n.x = n.w / 2;
		if (guide.vertical) n.y = 0;
		else if (guide.boundtop) n.y = -n.h / 2;
		else if (guide.boundbottom) n.y = n.h / 2;

		guide = {};

		while (c) {
			if (n != c) {
				if (Math.abs(n.x - c.x) < minh) {
					guide.horisontal = c;
				}
				if (Math.abs(n.y - c.y) < minv) {
					guide.vertical = c;
				}
				if (!n.r && !c.r) {
					if (Math.abs((n.x - n.w / 2) - (c.x + c.w / 2)) < minh) {
						guide.boundright = c;
					}
					if (Math.abs((n.x + n.w / 2) - (c.x - c.w / 2)) < minh) {
						guide.boundleft = c;
					}
					if (Math.abs((n.y - n.h / 2) - (c.y + c.h / 2)) < minv) {
						guide.boundbottom = c;
					}
					if (Math.abs((n.y + n.h / 2) - (c.y - c.h / 2)) < minv) {
						guide.boundtop = c;
					}
				}
			}
			c = c.next;
		}

		if (guide.horisontal) n.x = guide.horisontal.x;
		else if (guide.boundleft) n.x = guide.boundleft.x - guide.boundleft.w / 2 - n.w / 2;
		else if (guide.boundright) n.x = guide.boundright.x + guide.boundright.w / 2 + n.w / 2;
		if (guide.vertical) n.y = guide.vertical.y;
		else if (guide.boundtop) n.y = guide.boundtop.y - guide.boundtop.h / 2 - n.h / 2;
		else if (guide.boundbottom) n.y = guide.boundbottom.y + guide.boundbottom.h / 2 + n.h / 2;

		this.guide = guide;
	};
	
	this.debugCycle = function() {
		var n = this.root;
		var ctx = this.ctx;

		ctx.save();
		ctx.fillRect(0, 0, this.root.w, this.root.h);
		ctx.translate(this.root.w / 2, this.root.h / 2);

		while (n) {
			ctx.save();
			ctx.globalAlpha *= n.a;
			ctx.translate(n.x, n.y);
			ctx.rotate(n.r / 180 * Math.PI);
			ctx.scale(n.zx, n.zy);

			if (n.a) {
				if (n.drawCB) n.drawCB(n, ctx);
			}
			if (n.a && n.child) {
				n = n.child;
			} else {
				while (n) {
					if (this.highlighted === n) {
						ctx.strokeStyle = 'white';
						ctx.strokeRect(-n.w/2, -n.h/2, n.w, n.h);
						var p = n.parent, i;
						for (i in n.parent) if (n === p[i]) break;
						ctx.fillStyle = 'white';
						ctx.fillText(i+'', -n.w/2+5, n.h/2-5);
						ctx.rotate(-n.r / 180 * Math.PI);
						if (this.guide && this.guide.vertical) {
							ctx.beginPath();
							ctx.moveTo(-10000, 0);
							ctx.lineTo(10000, 0);
							ctx.stroke();
						}
						if (this.guide && this.guide.horisontal) {
							ctx.beginPath();
							ctx.moveTo(0, -10000);
							ctx.lineTo(0, 10000);
							ctx.stroke();
						}
					} else {
						ctx.strokeStyle = 'gray';
						ctx.strokeRect(-n.w/2, -n.h/2, n.w, n.h);
					}

					ctx.restore();
					if (n.next) {
						n = n.next;
						break;
					}
					n = n.parent;
				}
			}
		}

		ctx.restore();

		this.mousedown = undefined;
		this.mousemove = undefined;
		this.mouseup = undefined;
	};
	
	this.onchange = function(obj) {
		this.updateHierarhy();
		this.updateInfo();
		this.debugCycle();
	}
	
	// обработчик клика
	this.click = function(evt) {
		var pos = this.getMousePos(this.canvas, evt);
		this.highlighted = this.clicked = this.getClickedObject(pos);
		this.mousedown = pos;
		
		if (evt.button === 2) {
			if (event.altKey && this.clicked && this.clicked.parent) this.del(this.clicked);
			else this.tmpoffset = {x: this.root.x - pos.x, y: this.root.y - pos.y};
			this.highlighted = this.clicked = undefined;
			this.debugCycle();
			evt.preventDefault();
			return;
		} else if (this.clicked && this.clicked.parent) {
			if (event.ctrlKey && evt.button === 0) {
				this.highlighted = this.clicked = this.add(this.clicked.parent, this.clicked);
			}
			
			this.tmpmp = this.convertPointToNodeTransform(this.clicked.parent, pos);
			this.tmpst = {x: this.clicked.x, y: this.clicked.y, r: this.clicked.r, zx: this.clicked.zx, zy:this.clicked.zy};
			this.tmpr  = this.tmpst.r - Math.atan2(pos.y - this.tmpst.y, pos.x - this.tmpst.x) / Math.PI * 180;
			
			if (this.onchange) this.onchange(this.clean(this.copy(this.root, true)));
			this.debugCycle();
			
			if (this.onselect) {
				var i;
				for (i in this.highlighted.parent) {
					if (this.highlighted.parent[i] === this.highlighted) break;
				}
				this.onselect(i);
			}
		}
	};

	// движение мыши с нажатием
	this.drag = function(evt) {
		var pos = this.getMousePos(this.canvas, evt);
		this.mousemove = pos;
		
		if (evt.button === 2) {
			this.root.x = pos.x + this.tmpoffset.x;
			this.root.y = pos.y + this.tmpoffset.y;
		} else if (this.clicked && this.clicked.parent) {
			pos = this.convertPointToNodeTransform(this.clicked.parent, pos);

			if (event.altKey) {
				var dx1 = this.tmpmp.x - this.tmpst.x;
				var dy1 = this.tmpmp.y - this.tmpst.y;
				var d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
				var dx2 = pos.x - this.tmpst.x;
				var dy2 = pos.y - this.tmpst.y;
				var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
				var d = d2 / d1;
				this.clicked.zx = this.tmpst.zx * d;
				this.clicked.zy = this.tmpst.zy * d;
				var r = Math.atan2(pos.y - this.tmpst.y, pos.x - this.tmpst.x) / Math.PI * 180;
				this.clicked.r = r + this.tmpr;
			} else {
				this.clicked.x = this.tmpst.x + (pos.x - this.tmpmp.x);
				this.clicked.y = this.tmpst.y + (pos.y - this.tmpmp.y);
				this.alignObject(this.clicked);
			}
		}
		this.debugCycle();
		evt.preventDefault();
	};

	// отпускание мыши
	this.release = function(evt) {
		var pos = this.getMousePos(this.canvas, evt);
		this.mouseup = pos;
		this.clicked = undefined;

		if (this.highlighted) {
			this.guide = undefined;
			if (this.onchange) this.onchange(this.clean(this.copy(this.root, true)));
			if (this.onselect) {
				var i;
				for (i in this.highlighted.parent) {
					if (this.highlighted.parent[i] === this.highlighted) break;
				}
				this.onselect(i);
			}
			this.debugCycle();
		}
	};
	
	this.onchange();
};


window.Tree2d = Tree2d;

})();
