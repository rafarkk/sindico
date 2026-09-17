/*
 * Animação isométrica que "constrói" o condomínio configurado
 * enquanto a configuração é criada (ConstrucaoCondominioLimitada.abrir).
 * Versão COM LIMITE: ilustra no máximo 12 prédios, 20 andares, 8 lojas, 4 portarias e 24/24/10 vagas.
 */
(function (window, $) {
	'use strict';

	var COS = Math.cos(Math.PI / 6), SIN = 0.5;

	// Acima destes números a ilustração mostra uma amostra; os contadores sempre usam os valores reais
	var LIMITE = { predios: 12, andares: 20, lojas: 8, portarias: 4, cobertas: 24, descobertas: 24, visitantes: 10 };

	// Medidas em "metros" do mundo isométrico
	var BW = 4, BD = 4, GAP = 3, FH = 0.9, MARGEM = 2;
	var SW = 1.3, SD = 2.6;
	var DUR_NIVEL = 320;

	var COR = {
		lote: ['#cde6c4', '#a9cb9e', '#94b98a'],
		rua: ['#4a4f57', '#3b3f46', '#30343a'],
		faixa: '#f5f5f5',
		calcada: '#e4e4df',
		praca: '#e9ebe5',
		asfalto: '#9aa1a8',
		linhaVaga: '#ffffff',
		predio: ['#f7f9fa', '#e6ecef', '#c9d4da'],
		faixaAndar: ['#bcc8cf', '#a9b7bf'],
		laje: ['#5a6068', '#474c53', '#3a3f45'],
		caixaDagua: ['#eef1f3', '#d5dde2', '#b9c4cb'],
		vidro: '#8fb0c0',
		luz: '#ffd36b',
		porta: '#319DB5',
		loja: ['#f4e3c6', '#e9d3ad', '#d8bd90'],
		toldo: '#319DB5',
		portaria: ['#ffffff', '#eef1f3', '#d5dde2'],
		cobertura: ['#6cc0d2', '#319DB5', '#27819a'],
		guindaste: ['#ffd24a', '#f2b705', '#c99400'],
		cabo: '#353940',
		visitante: '#3d7fc4',
		tronco: ['#9c7a57', '#8a6a4a', '#765a3e'],
		copa: ['#7cbf6b', '#62a954'],
		carros: ['#e05a47', '#3b6fb6', '#f0c24b', '#5b6770', '#f4f4f4', '#2f9e6f']
	};

	function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
	function suave(p) { return 1 - Math.pow(1 - clamp01(p), 3); }
	function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
	function mistura(a, b, p) {
		var x = hexRgb(a), y = hexRgb(b);
		return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * p); }).join(',') + ')';
	}
	function sombras(cor) { return [mistura(cor, '#ffffff', 0.15), cor, mistura(cor, '#000000', 0.22)]; }
	function aleatorio(semente) {
		return function () { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
	}
	function agora() { return window.performance && performance.now ? performance.now() : Date.now(); }
	function numero(n) { return Number(n).toLocaleString('pt-BR'); }

	/* ---------- Desenho isométrico ---------- */

	function Pintor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.S = 10; this.ox = 0; this.oy = 0; this.dpr = 1;
	}
	Pintor.prototype.p = function (x, y, z) {
		return [this.ox + (x - y) * COS * this.S, this.oy + (x + y) * SIN * this.S - (z || 0) * this.S];
	};
	Pintor.prototype.poli = function (pts, cor) {
		var c = this.ctx;
		c.beginPath();
		for (var i = 0; i < pts.length; i++) {
			if (i) c.lineTo(pts[i][0], pts[i][1]); else c.moveTo(pts[i][0], pts[i][1]);
		}
		c.closePath();
		c.fillStyle = cor;
		c.fill();
	};
	// Retângulo horizontal na altura z
	Pintor.prototype.chao = function (x, y, w, d, cor, z) {
		z = z || 0;
		this.poli([this.p(x, y, z), this.p(x + w, y, z), this.p(x + w, y + d, z), this.p(x, y + d, z)], cor);
	};
	// Caixa: faces visíveis são o topo, a frente-esquerda (y + d) e a frente-direita (x + w)
	Pintor.prototype.caixa = function (x, y, z, w, d, h, cores) {
		this.poli([this.p(x, y + d, z), this.p(x + w, y + d, z), this.p(x + w, y + d, z + h), this.p(x, y + d, z + h)], cores[1]);
		this.poli([this.p(x + w, y + d, z), this.p(x + w, y, z), this.p(x + w, y, z + h), this.p(x + w, y + d, z + h)], cores[2]);
		this.poli([this.p(x, y, z + h), this.p(x + w, y, z + h), this.p(x + w, y + d, z + h), this.p(x, y + d, z + h)], cores[0]);
	};
	// Retângulos desenhados sobre as faces verticais
	Pintor.prototype.faceY = function (yp, x1, x2, z1, z2, cor) {
		this.poli([this.p(x1, yp, z1), this.p(x2, yp, z1), this.p(x2, yp, z2), this.p(x1, yp, z2)], cor);
	};
	Pintor.prototype.faceX = function (xp, y1, y2, z1, z2, cor) {
		this.poli([this.p(xp, y1, z1), this.p(xp, y2, z1), this.p(xp, y2, z2), this.p(xp, y1, z2)], cor);
	};
	// Texto "pintado" no chão
	Pintor.prototype.textoChao = function (txt, x, y, tam, cor) {
		var c = this.ctx, d = this.dpr, S = this.S;
		c.save();
		c.setTransform(d * COS * S, d * SIN * S, -d * COS * S, d * SIN * S, d * this.ox, d * this.oy);
		c.font = '700 ' + tam + 'px "Open Sans", Arial, sans-serif';
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		c.fillStyle = cor;
		c.fillText(txt, x, y);
		c.restore();
	};

	/* ---------- Montagem da cena a partir da configuração ---------- */

	function montarCena(cfg) {
		var n = {
			predios: Math.min(cfg.predios, LIMITE.predios),
			andares: Math.min(cfg.andares_por_predio, LIMITE.andares),
			lojas: Math.min(cfg.lojas, LIMITE.lojas),
			portarias: Math.min(cfg.portarias, LIMITE.portarias),
			cobertas: Math.min(cfg.vagas.cobertas, LIMITE.cobertas),
			descobertas: Math.min(cfg.vagas.descobertas, LIMITE.descobertas),
			visitantes: Math.min(cfg.vagas.visitantes, LIMITE.visitantes)
		};
		var amostra = cfg.predios > n.predios || cfg.andares_por_predio > n.andares ||
			cfg.lojas > n.lojas || cfg.portarias > n.portarias ||
			cfg.vagas.cobertas > n.cobertas || cfg.vagas.descobertas > n.descobertas || cfg.vagas.visitantes > n.visitantes;

		var rnd = aleatorio(cfg.predios * 131 + cfg.andares_por_predio * 17 + cfg.vagas.cobertas + 7);
		var chao = [], solidos = [], fases = [];

		// Prédios em grade
		var cols = Math.ceil(Math.sqrt(n.predios)), rows = Math.ceil(n.predios / cols);
		var x0 = MARGEM, y0 = MARGEM;
		var regiaoW = cols * (BW + GAP) - GAP, regiaoD = rows * (BD + GAP) - GAP;

		// Estacionamento à direita dos prédios
		var totalVagas = n.cobertas + n.descobertas + n.visitantes;
		var porFila = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(totalVagas * 1.5))));
		var px0 = x0 + regiaoW + 3, py0 = y0;
		function vagaPos(i) {
			var r = Math.floor(i / porFila);
			return { x: px0 + (i % porFila) * SW, y: py0 + r * SD + Math.floor(r / 2) * 2.2 };
		}
		var parkW = totalVagas ? Math.min(totalVagas, porFila) * SW : 0;
		var parkEnd = totalVagas ? vagaPos(totalVagas - 1).y + SD : py0;

		// Faixa da frente: portarias e lojas, voltadas para a rua
		var yF = Math.max(y0 + regiaoD + 2, totalVagas ? parkEnd + 2.6 : 0);
		var fimFaixa = MARGEM + n.portarias * 4.8 + (n.portarias && n.lojas ? 0.6 : 0) + n.lojas * 3.0;
		var loteW = Math.max(x0 + regiaoW, totalVagas ? px0 + parkW : 0, fimFaixa + (totalVagas ? 3.2 : 0)) + MARGEM;
		var loteD = yF + 2.2 + 1.8;

		/* Linha do tempo */
		var tPort = 600, passoPort = 250;
		var tPred = tPort + n.portarias * passoPort + 200;
		var passoPredio = n.predios > 1 ? Math.min(600, 3000 / n.predios) : 0;
		var passoAndar = Math.min(260, 3200 / (n.andares + 1));
		var fimPredios = tPred + (n.predios - 1) * passoPredio + (n.andares + 1) * passoAndar + 350;
		var tLoja = Math.max(tPred + 400, fimPredios - 800), passoLoja = 220;
		var tVaga = tLoja + Math.max(n.lojas, 1) * passoLoja;
		var passoVaga = totalVagas ? Math.min(90, 2000 / totalVagas) : 0;
		var fim = Math.max(fimPredios, tVaga + totalVagas * passoVaga + (totalVagas ? 800 : 0)) + 200;

		fases.push({ inicio: 0, texto: 'Preparando o terreno' });
		if (n.portarias) fases.push({ inicio: tPort, texto: n.portarias > 1 ? 'Instalando as portarias' : 'Instalando a portaria' });
		fases.push({ inicio: tPred, texto: n.predios > 1 ? 'Construindo os prédios' : 'Construindo o prédio' });
		if (n.lojas) fases.push({ inicio: tLoja, texto: 'Abrindo as lojas' });
		if (totalVagas) fases.push({ inicio: tVaga, texto: 'Demarcando as vagas' });

		/* Terreno, rua, calçada, praça e asfalto */
		chao.push(function (P, t) {
			var p = suave(t / 700);
			if (p <= 0) return;
			var c = P.ctx;
			c.globalAlpha = p;
			P.caixa(0, 0, -0.4, loteW, loteD, 0.4, COR.lote);
			P.caixa(-2, loteD, -0.4, loteW + 4, 3.2, 0.4, COR.rua);
			for (var xx = -1.5; xx < loteW + 1.5; xx += 2) P.chao(xx, loteD + 1.5, 1, 0.16, COR.faixa);
			P.chao(0, loteD - 1.2, loteW, 1.2, COR.calcada);
			P.chao(x0 - 1, y0 - 1, regiaoW + 2, regiaoD + 2, COR.praca);
			if (totalVagas) {
				P.chao(px0 - 0.5, py0 - 0.5, parkW + 1, parkEnd - py0 + 1, COR.asfalto);
				P.chao(px0 - 0.5, parkEnd + 0.5, loteW - MARGEM - (px0 - 0.5), 1.6, COR.asfalto);
				P.chao(loteW - MARGEM - 2.6, parkEnd + 0.5, 2.6, loteD - 1.2 - (parkEnd + 0.5), COR.asfalto);
			}
			c.globalAlpha = 1;
		});

		/* Árvores */
		var arvores = [[0.9, 0.9], [loteW - 0.9, 0.9], [0.9, loteD - 2.2]];
		if (n.predios) arvores.push([px0 - 1.5, y0 + 0.9]);
		// Preenche o gramado entre os prédios e a faixa da frente
		for (var ay = y0 + regiaoD + 1.6; ay < yF - 1.2; ay += 2.4) {
			for (var ax = x0 + 0.8; ax < x0 + regiaoW + 1; ax += 2.6) {
				if (rnd() < 0.6) arvores.push([ax + rnd() * 0.6, ay + rnd() * 0.6]);
			}
		}
		arvores.forEach(function (a, i) {
				var inicio = 300 + Math.min(i, 12) * 90;
				solidos.push({
					chave: a[0] + a[1],
					desenhar: function (P, t) {
						var p = suave((t - inicio) / 500);
						if (p <= 0) return;
						var c = P.ctx, centro = P.p(a[0], a[1], 1.25 * p);
						P.caixa(a[0] - 0.1, a[1] - 0.1, 0, 0.2, 0.2, 0.7 * p, COR.tronco);
						c.beginPath(); c.arc(centro[0], centro[1], 0.75 * P.S * p, 0, Math.PI * 2);
						c.fillStyle = COR.copa[1]; c.fill();
						c.beginPath(); c.arc(centro[0] - 0.18 * P.S * p, centro[1] - 0.2 * P.S * p, 0.45 * P.S * p, 0, Math.PI * 2);
						c.fillStyle = COR.copa[0]; c.fill();
					}
				});
			});

		/* Portarias (com cancela) */
		var portariasFeitas = [];
		for (var ip = 0; ip < n.portarias; ip++) {
			(function (i) {
				var x = MARGEM + i * 4.8, y = yF, inicio = tPort + i * passoPort;
				portariasFeitas.push(inicio + 450);
				solidos.push({
					chave: x + 1.1 + y + 1.1,
					desenhar: function (P, t) {
						var p = suave((t - inicio) / 450);
						if (p <= 0) return;
						var z = (1 - p) * 3;
						P.ctx.globalAlpha = p;
						P.caixa(x, y, z, 2.2, 2.2, 1.3, COR.portaria);
						P.faceY(y + 2.2, x + 0.35, x + 1.85, z + 0.55, z + 1.05, COR.vidro);
						P.faceX(x + 2.2, y + 0.4, y + 1.1, z, z + 1.0, COR.porta);
						P.caixa(x - 0.2, y - 0.2, z + 1.3, 2.6, 2.6, 0.16, COR.laje);
						// cancela
						P.caixa(x + 2.35, y + 1.75, 0, 0.3, 0.3, 0.8 * p, COR.laje);
						for (var s = 0; s < 5; s++) {
							P.caixa(x + 2.65 + s * 0.36, y + 1.84, 0.62, 0.36, 0.12, 0.12,
								sombras(s % 2 ? '#ffffff' : '#e05a47'));
						}
						P.ctx.globalAlpha = 1;
					}
				});
			})(ip);
		}

		/* Prédios: térreo, andares (2 apartamentos por andar) e cobertura */
		var predios = [];
		for (var ib = 0; ib < n.predios; ib++) {
			(function (i) {
				var x = x0 + (i % cols) * (BW + GAP), y = y0 + Math.floor(i / cols) * (BD + GAP);
				var inicio = tPred + i * passoPredio;
				var predio = { inicio: inicio, fimCobertura: inicio + (n.andares + 1) * passoAndar + 350 };
				predios.push(predio);

				function nivel(P, t, k) {
					var ini = inicio + k * passoAndar;
					var p = suave((t - ini) / DUR_NIVEL);
					if (p <= 0) return false;
					var z = k * FH + (1 - p) * 2.5;
					P.ctx.globalAlpha = p;
					P.caixa(x, y, z, BW, BD, FH, COR.predio);
					P.faceY(y + BD, x, x + BW, z, z + 0.07, COR.faixaAndar[0]);
					P.faceX(x + BW, y, y + BD, z, z + 0.07, COR.faixaAndar[1]);
					if (k === 0) {
						P.faceY(y + BD, x + 1.5, x + 2.5, z + 0.07, z + 0.78, COR.porta);
						P.faceX(x + BW, y + 0.6, y + 3.4, z + 0.3, z + 0.72, COR.vidro);
					} else {
						// Apartamento A (face esquerda) acende primeiro, depois o B (face direita)
						var luzA = clamp01((t - ini - DUR_NIVEL) / 250);
						var luzB = clamp01((t - ini - DUR_NIVEL - 150) / 250);
						for (var j = 0; j < 2; j++) {
							P.faceY(y + BD, x + 0.6 + j * 1.8, x + 1.6 + j * 1.8, z + 0.28, z + 0.68, mistura(COR.vidro, COR.luz, luzA));
							P.faceX(x + BW, y + 0.6 + j * 1.8, y + 1.6 + j * 1.8, z + 0.28, z + 0.68, mistura(COR.vidro, COR.luz, luzB));
						}
					}
					P.ctx.globalAlpha = 1;
					return true;
				}

				// Guindaste ao lado do prédio: sobe no início da obra e some depois da cobertura
				function guindaste(P, t, topoObra) {
					var aparece = suave((t - inicio + 200) / 400);
					var some = clamp01((t - predio.fimCobertura - 300) / 500);
					var alfa = aparece * (1 - some);
					if (alfa <= 0) return;
					var mx = x + BW + 0.5, my = y + BD / 2 - 0.15;
					var alturaTotal = (n.andares + 1) * FH + 2.2;
					var zTopo = alturaTotal * aparece;
					var c = P.ctx;
					c.globalAlpha = alfa;
					P.caixa(mx, my, 0, 0.3, 0.3, zTopo, COR.guindaste);
					P.caixa(x - 0.4, my + 0.05, zTopo, mx - x + 0.4, 0.2, 0.22, COR.guindaste);
					P.caixa(mx + 0.3, my + 0.05, zTopo, 1.5, 0.2, 0.22, COR.guindaste);
					P.caixa(mx + 1.2, my - 0.05, zTopo - 0.45, 0.6, 0.4, 0.45, COR.laje);
					P.caixa(mx - 0.05, my - 0.05, zTopo + 0.22, 0.4, 0.4, 0.35, COR.guindaste);
					// Cabo descendo até o andar em construção
					var hx = x + BW / 2, hy = my + 0.15;
					var a = P.p(hx, hy, zTopo), b = P.p(hx, hy, Math.max(topoObra, 0) + 0.25);
					c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
					c.lineWidth = Math.max(1, P.S * 0.05); c.strokeStyle = COR.cabo; c.stroke();
					P.caixa(hx - 0.15, hy - 0.15, Math.max(topoObra, 0) + 0.1, 0.3, 0.3, 0.15, COR.laje);
					c.globalAlpha = 1;
				}

				solidos.push({
					chave: x + BW / 2 + y + BD / 2,
					desenhar: function (P, t) {
						// Topo do que já foi colocado (inclui o andar descendo)
						var topoObra = 0;
						var k;
						for (k = 0; k <= n.andares; k++) {
							if (!nivel(P, t, k)) break;
							var pk = suave((t - inicio - k * passoAndar) / DUR_NIVEL);
							topoObra = k * FH + (1 - pk) * 2.5 + FH;
						}
						if (k > n.andares) {
							var ini = inicio + (n.andares + 1) * passoAndar;
							var p = suave((t - ini) / 350);
							if (p > 0) {
								var z = (n.andares + 1) * FH;
								P.ctx.globalAlpha = p;
								P.caixa(x, y, z, BW, BD, 0.18, COR.laje);
								P.caixa(x + 0.6, y + 0.6, z + 0.18 + (1 - p) * 1.5, 1.3, 1.3, 0.9, COR.caixaDagua);
								P.ctx.globalAlpha = 1;
								topoObra = z + 0.18 + (1 - p) * 1.5 + 0.9;
							}
						}
						guindaste(P, t, topoObra);
					}
				});
			})(ib);
		}

		/* Lojas com toldo listrado */
		var lojasFeitas = [];
		for (var il = 0; il < n.lojas; il++) {
			(function (i) {
				var x = MARGEM + n.portarias * 4.8 + (n.portarias ? 0.6 : 0) + i * 3.0, y = yF;
				var inicio = tLoja + i * passoLoja;
				lojasFeitas.push(inicio + 450);
				solidos.push({
					chave: x + 1.3 + y + 1.1,
					desenhar: function (P, t) {
						var p = suave((t - inicio) / 450);
						if (p <= 0) return;
						var z = (1 - p) * 3;
						P.ctx.globalAlpha = p;
						P.caixa(x, y, z, 2.6, 2.2, 1.6, COR.loja);
						P.faceY(y + 2.2, x + 0.3, x + 2.3, z + 0.1, z + 1.05, COR.vidro);
						P.faceY(y + 2.2, x + 0.5, x + 2.1, z + 1.38, z + 1.52, '#353940');
						for (var s = 0; s < 6; s++) {
							var xa = x + s * 2.6 / 6, xb = x + (s + 1) * 2.6 / 6;
							P.poli([P.p(xa, y + 2.2, z + 1.3), P.p(xb, y + 2.2, z + 1.3), P.p(xb, y + 2.8, z + 1.02), P.p(xa, y + 2.8, z + 1.02)],
								s % 2 ? '#ffffff' : COR.toldo);
						}
						P.ctx.globalAlpha = 1;
					}
				});
			})(il);
		}

		/* Vagas: cobertas, descobertas e visitantes (com carros) */
		var vagasFeitas = [];
		var numeroVaga = 0, numeroVisitante = 0;
		for (var iv = 0; iv < totalVagas; iv++) {
			(function (i) {
				var tipo = i < n.cobertas ? 'coberta' : (i < n.cobertas + n.descobertas ? 'descoberta' : 'visitante');
				var pos = vagaPos(i), x = pos.x, y = pos.y;
				var inicio = tVaga + i * passoVaga;
				var rotulo = tipo === 'visitante'
					? 'V' + (cfg.vagas.numeradas ? ++numeroVisitante : '')
					: (cfg.vagas.numeradas ? String(++numeroVaga) : '');
				var temCarro = rnd() < (tipo === 'visitante' ? 0.3 : 0.55);
				var corCarro = COR.carros[Math.floor(rnd() * COR.carros.length)];
				vagasFeitas.push(inicio + 300);

				chao.push(function (P, t) {
					var p = clamp01((t - inicio) / 300);
					if (p <= 0) return;
					P.ctx.globalAlpha = p;
					if (tipo === 'visitante') P.chao(x + 0.08, y + 0.08, SW - 0.16, SD - 0.16, 'rgba(61,127,196,.55)', 0.01);
					P.chao(x, y, 0.07, SD, COR.linhaVaga, 0.02);
					P.chao(x + SW - 0.07, y, 0.07, SD, COR.linhaVaga, 0.02);
					P.chao(x, y, SW, 0.07, COR.linhaVaga, 0.02);
					if (rotulo) P.textoChao(rotulo, x + SW / 2, y + SD - 0.55, 0.6, '#ffffff');
					P.ctx.globalAlpha = 1;
				});

				if (temCarro) {
					solidos.push({
						chave: x + SW / 2 + y + SD / 2,
						desenhar: function (P, t) {
							var p = suave((t - inicio - 250) / 500);
							if (p <= 0) return;
							var dy = (1 - p) * 4;
							P.ctx.globalAlpha = p;
							P.caixa(x + 0.2, y + 0.35 + dy, 0.12, 0.9, 1.9, 0.42, sombras(corCarro));
							P.caixa(x + 0.3, y + 0.85 + dy, 0.54, 0.7, 0.95, 0.34, [mistura(corCarro, '#ffffff', 0.2), '#6f8e9c', '#58727e']);
							P.ctx.globalAlpha = 1;
						}
					});
				}
				if (tipo === 'coberta') {
					solidos.push({
						chave: x + SW / 2 + y + SD / 2 + 0.05,
						desenhar: function (P, t) {
							var p = suave((t - inicio - 200) / 350);
							if (p <= 0) return;
							var z = 1.35 + (1 - p) * 1.5;
							P.ctx.globalAlpha = p;
							P.caixa(x + 0.02, y + SD - 0.14, 0, 0.1, 0.1, z, COR.laje);
							P.caixa(x + SW - 0.12, y + SD - 0.14, 0, 0.1, 0.1, z, COR.laje);
							P.caixa(x, y, z, SW, SD, 0.12, COR.cobertura);
							P.ctx.globalAlpha = 1;
						}
					});
				}
			})(iv);
		}

		solidos.sort(function (a, b) { return a.chave - b.chave; });

		// Limites da cena (para enquadrar no canvas)
		var altura = (n.andares + 1) * FH + 1.2;
		var pontos = [
			[0, 0, -0.4], [loteW, 0, -0.4], [-2, loteD + 3.2, -0.4], [loteW + 2, loteD + 3.2, -0.4], [loteW + 2, loteD, -0.4],
			[0, 0, 2.2], [loteW - 0.9, 0.9, 2.2]
		];
		if (n.predios) pontos.push([x0, y0, altura], [x0 + regiaoW, y0, altura], [x0, y0 + regiaoD, altura]);

		function feitos(lista, t) {
			var c = 0;
			for (var i = 0; i < lista.length; i++) if (t >= lista[i]) c++;
			return c;
		}
		// Conta só as vagas de um tipo (as vagas estão em ordem: cobertas, descobertas, visitantes)
		function feitosFaixa(lista, de, ate, t) {
			var c = 0;
			for (var i = de; i < ate; i++) if (t >= lista[i]) c++;
			return c;
		}
		function proporcional(real, feito, total) {
			if (!total) return 0;
			return feito >= total ? real : Math.round(real * feito / total);
		}

		return {
			fim: fim,
			amostra: amostra,
			pontos: pontos,
			fases: fases,
			desenhar: function (P, t) {
				for (var i = 0; i < chao.length; i++) chao[i](P, t);
				for (var j = 0; j < solidos.length; j++) solidos[j].desenhar(P, t);
			},
			contadores: function (t) {
				var andaresFeitos = 0, prediosFeitos = 0;
				predios.forEach(function (b) {
					andaresFeitos += Math.max(0, Math.min(n.andares, Math.floor((t - b.inicio - DUR_NIVEL) / passoAndar)));
					if (t >= b.fimCobertura) prediosFeitos++;
				});
				return {
					predios: proporcional(cfg.predios, prediosFeitos, n.predios),
					apartamentos: proporcional(cfg.total_apartamentos, andaresFeitos, n.predios * n.andares),
					portarias: proporcional(cfg.portarias, feitos(portariasFeitas, t), n.portarias),
					lojas: proporcional(cfg.lojas, feitos(lojasFeitas, t), n.lojas),
					vagas: proporcional(cfg.vagas.cobertas + cfg.vagas.descobertas + cfg.vagas.visitantes, feitos(vagasFeitas, t), totalVagas),
					cobertas: proporcional(cfg.vagas.cobertas, feitosFaixa(vagasFeitas, 0, n.cobertas, t), n.cobertas),
					descobertas: proporcional(cfg.vagas.descobertas, feitosFaixa(vagasFeitas, n.cobertas, n.cobertas + n.descobertas, t), n.descobertas),
					visitantes: proporcional(cfg.vagas.visitantes, feitosFaixa(vagasFeitas, n.cobertas + n.descobertas, totalVagas, t), n.visitantes)
				};
			},
			texto: function (t) {
				var txt = fases[0].texto;
				fases.forEach(function (f) { if (t >= f.inicio) txt = f.texto; });
				return txt;
			}
		};
	}

	/* ---------- Janela e ciclo da animação ---------- */

	var est = null;

	function enquadrar() {
		if (!est) return;
		var P = est.pintor, canvas = P.canvas;
		var w = canvas.parentNode.clientWidth;
		var h = Math.round(Math.max(260, Math.min(460, w * 0.62)));
		var dpr = window.devicePixelRatio || 1;
		canvas.style.height = h + 'px';
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		P.dpr = dpr;

		var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		est.cena.pontos.forEach(function (q) {
			var sx = (q[0] - q[1]) * COS, sy = (q[0] + q[1]) * SIN - q[2];
			minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
			minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
		});
		var pad = 18, rodape = est.cena.amostra ? 22 : 0;
		P.S = Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad - rodape) / (maxY - minY));
		P.ox = (w - (maxX - minX) * P.S) / 2 - minX * P.S;
		P.oy = (h - rodape - (maxY - minY) * P.S) / 2 - minY * P.S;
		desenhar();
	}

	function contador(id, valor, singular, plural) {
		var el = $('#cn-' + id);
		el.text(numero(valor));
		el.next('span').text(valor === 1 ? singular : plural);
	}

	// Quantidade de cada tipo de vaga, uma por linha abaixo do total
	function detalheVagas(config, k) {
		var linhas = [];
		if (config.vagas.cobertas) linhas.push(numero(k.cobertas) + (k.cobertas === 1 ? ' coberta' : ' cobertas'));
		if (config.vagas.descobertas) linhas.push(numero(k.descobertas) + (k.descobertas === 1 ? ' descoberta' : ' descobertas'));
		if (config.vagas.visitantes) linhas.push(numero(k.visitantes) + (k.visitantes === 1 ? ' de visitante' : ' de visitantes'));
		return linhas.join('<br>');
	}

	function tempo() {
		return Math.min(agora() - est.inicio, est.cena.fim);
	}

	function desenhar() {
		var P = est.pintor, c = P.ctx, t = tempo();
		c.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
		c.clearRect(0, 0, P.canvas.width, P.canvas.height);
		est.cena.desenhar(P, t);

		var k = est.cena.contadores(t);
		contador('predios', k.predios, 'prédio', 'prédios');
		contador('apartamentos', k.apartamentos, 'apartamento', 'apartamentos');
		contador('portarias', k.portarias, 'portaria', 'portarias');
		contador('lojas', k.lojas, 'loja', 'lojas');
		// Total = soma dos tipos, para bater sempre com o detalhe
		contador('vagas', k.cobertas + k.descobertas + k.visitantes, 'vaga', 'vagas');
		$('#cn-vagas-detalhe').html(detalheVagas(est.config, k));

		var animFeita = t >= est.cena.fim;
		var progresso = t / est.cena.fim;
		if (est.situacao === 'ok') progresso = animFeita ? 1 : progresso;
		else progresso = Math.min(progresso, 0.95);
		$('#construcao-barra').css('width', Math.round(progresso * 100) + '%');

		if (!animFeita) {
			$('#construcao-status').text(est.cena.texto(t) + '…');
		} else if (est.situacao === 'criando') {
			$('#construcao-status').text('Finalizando a configuração…');
		}
		return animFeita;
	}

	function ciclo() {
		if (!est) return;
		var animFeita = desenhar();
		if (animFeita && est.situacao !== 'criando') {
			concluir();
			return;
		}
		est.raf = window.requestAnimationFrame(ciclo);
	}

	function concluir() {
		var ok = est.situacao === 'ok';
		$('#construcao-titulo').text(ok ? 'Condomínio criado!' : 'Não deu certo');
		$('#construcao-status').text(ok
			? 'Sua configuração está pronta.'
			: 'Não foi possível criar a configuração. Verifique sua conexão e tente de novo.');
		$('#construcao-tentar').toggle(!ok);
		$('#construcao-json').toggle(ok);
		$('#construcao-acoes').prop('hidden', false);
		$('#construcao').addClass('construcao-fim');
		(ok ? $('#construcao-json') : $('#construcao-tentar')).focus();
	}

	function chamarApi() {
		var meu = est;
		meu.situacao = 'criando';
		Promise.resolve()
			.then(function () { return meu.criar(meu.config); })
			.then(function (resposta) { meu.resposta = resposta; meu.situacao = 'ok'; })
			.catch(function (erro) { meu.erro = erro; meu.situacao = 'erro'; });
	}

	function abrir(config, criar, aoFechar) {
		fechar();
		var canvas = document.getElementById('construcao-canvas');
		est = {
			config: config,
			criar: criar,
			aoFechar: aoFechar,
			cena: montarCena(config),
			pintor: new Pintor(canvas),
			inicio: agora(),
			situacao: 'criando',
			raf: 0
		};

		$('#construcao-titulo').text('Criando seu condomínio');
		$('#construcao-nota').text(est.cena.amostra ? 'Ilustração simplificada. Os números abaixo são os do seu condomínio.' : '');
		$('#cn-lojas').closest('div').toggle(config.lojas > 0);
		$('#construcao-acoes').prop('hidden', true);
		$('#construcao').removeClass('construcao-fim').prop('hidden', false);
		$('body').addClass('construcao-aberta');
		$('#construcao-card').focus();

		enquadrar();
		$(window).on('resize.construcao', enquadrar);
		chamarApi();
		est.raf = window.requestAnimationFrame(ciclo);
	}

	function fechar() {
		if (!est) return;
		window.cancelAnimationFrame(est.raf);
		$(window).off('resize.construcao');
		$('#construcao').prop('hidden', true);
		$('body').removeClass('construcao-aberta');
		var aoFechar = est.aoFechar;
		est = null;
		if (aoFechar) aoFechar();
	}

	$(function () {
		$('#construcao-fechar').on('click', fechar);
		$('#construcao-tentar').on('click', function () {
			if (!est) return;
			$('#construcao-acoes').prop('hidden', true);
			$('#construcao').removeClass('construcao-fim');
			$('#construcao-titulo').text('Criando seu condomínio');
			chamarApi();
			est.raf = window.requestAnimationFrame(ciclo);
		});
		$('#construcao-json').on('click', function () {
			if (!est) return;
			var blob = new Blob([JSON.stringify(est.config, null, 2)], { type: 'application/json' });
			window.open(URL.createObjectURL(blob), '_blank');
		});
		$(document).on('keydown', function (e) {
			if (est && e.key === 'Escape' && $('#construcao').hasClass('construcao-fim')) fechar();
		});
	});

	window.ConstrucaoCondominioLimitada = { abrir: abrir, fechar: fechar };
})(window, jQuery);
