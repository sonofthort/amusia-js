var amusia = {}

amusia.tau = 6.283185307179586476925286766559

amusia.Wave = function(sampleRate, data) {
	this.data = data || []
	this.sampleRate = sampleRate ? sampleRate : 22050
	this.duration = 0
}

amusia.Wave.prototype = {
	addNote: function(frequency, seconds, voiceFunc, volumeFunc, panFunc) {
		var sampleRate = this.sampleRate,
			data = this.data,
			duration = this.duration,
			numPoints = sampleRate * seconds
		
		for (var i = 0; i < numPoints; ++i) {
			var release = Math.pow((numPoints - i) / numPoints, 1 / 64),
				elapsed = i / sampleRate,
				time = duration + elapsed,
				volume = volumeFunc(seconds, elapsed, frequency, time), 
				y = voiceFunc(frequency, time) * volume * release,
				pan = panFunc(seconds, elapsed, frequency, time),
				left = y * Math.min(pan + 1, 1),
				right = y * Math.min(1 - pan, 1)
			
			data.push(left)
			data.push(right)
		}

		this.duration += seconds
	},
	toRiffWave: function() {
		var riffwave = new RIFFWAVE()
		
		riffwave.header.sampleRate = this.sampleRate
		riffwave.header.numChannels = 2
	
		var data = this.data,
			length = data.length,
			riffData = new Array(length)
			
		if (data instanceof Uint8Array) {
			for (var i = 0; i < length; ++i) {
				riffData[i] = data[i]
			}
		} else {
			for (var i = 0; i < length; ++i) {
				riffData[i] = Math.round(127 * data[i]) + 128
			}
		}
	
		riffwave.Make(riffData)
		
		return riffwave
	},
	toDataURI: function() {
		return this.toRiffWave().dataURI
	},
	toAudio: function() {
		var audio = new Audio()
		audio.src = this.toDataURI()
		return audio
	},
	serialize: function() {
		return {
			data: this.data,
			sampleRate: this.sampleRate,
			duration: this.duration
		}
	}
}

amusia.Wave.deserialize = function(data) {
	var res = new amusia.Wave(data.sampleRate, data.data)
	res.duration = data.duration
	return res
}

amusia.Wave.mix = function(waves, finalize) {
	var length = waves.length,
		datas = waves.map(function(wave) {return wave.data}),
		minSize = datas[0].length,
		sampleRate = waves[0].sampleRate
	
	for (var i = 1; i < length; ++i) {
		if (waves[i].sampleRate !== sampleRate) {
			throw 'sampleRate mismatch'
		}
		
		minSize = Math.min(minSize, datas[i].length)
	}
	
	var data,
		inverseLength = 1 / length
	
	if (finalize) {
		data = new Uint8Array(minSize)
	
		for (var i = 0; i < minSize; ++i) {
			var res = 0
			
			for (var j = 0; j < length; ++j) {
				res += datas[j][i]
			}
			
			data[i] = Math.round(127 * res * inverseLength) + 128
		}
	} else {
		data = new Array(minSize)
	
		for (var i = 0; i < minSize; ++i) {
			var res = 0
			
			for (var j = 0; j < length; ++j) {
				res += datas[j][i]
			}
			
			data[i] = res * inverseLength
		}
	}
	
	return new amusia.Wave(sampleRate, data)
}

amusia.constant = function(value) {
	return function() {
		return value
	}
}

amusia.equalTemperamentPlayer = function(notesPerOctave, offset) {
	return function(note) {
		return Math.pow(2, Math.floor(note + offset) / notesPerOctave)
	}
}

// tuned to standard tuning (A440)
amusia.twelveToneEqualTemperament = amusia.equalTemperamentPlayer(12, .37631656224)

amusia.voice = {}

amusia.voice.xForm = function(func) {
	return function(f, t) {
		return func(f * t * amusia.tau)
	}
}

amusia.voice.exponentiate = function(voice, exponent) {
	return function(f, t) {
		return Math.pow(voice(f, t), exponent)
	}
}

amusia.voice.split = function(voiceA, voiceB) {
	var sine = amusia.voices.sine
	
	return function(f, t) {
		return (sine(f, t) > 0 ? voiceA : voiceB)(f, t)
	}
}

amusia.voice.mix = function(a, b, interval) {
	return function(f, t) {
		return ((t % f) > (interval * 0.5) ? a : b)(f, t)
	}
}

// works best with rational exponents
amusia.voice.zapper = function(exponent) {
	return amusia.voice.xForm(function(x) {
		return Math.sin(x + Math.sin(Math.pow(x, exponent)))
	})
}

amusia.voices = {}

amusia.voices.sine = amusia.voice.xForm(function(x) {
	return Math.sin(x)
})

amusia.voices.cosine = amusia.voice.xForm(function(x) {
	return Math.cos(x)
})

amusia.voices.square = amusia.voice.xForm(function(x) {
	return Math.sin(x) > 0 ? 1 : -1
})

amusia.voices.sawtooth = amusia.voice.xForm(function(x) {
	return (x % 2) - 1
})

amusia.voices.triangle = amusia.voice.xForm(function(x) {
	return Math.tan(Math.sin(x))
})

amusia.voices.circular = amusia.voice.xForm(function(x) {
	var sinX = Math.sin(x)
	return sinX < 0 ? -Math.sqrt(-sinX) : Math.sqrt(sinX)
})

amusia.voices.mushy = amusia.voice.xForm(function(x) {
	return Math.sin(x + Math.cos(x))
})

amusia.voices.rockOrgan = amusia.voice.xForm(function(x) {
	return (Math.sin(2 * x) + Math.sin(2 * x / 3)) / 2
})

amusia.voices.flatBass = amusia.voice.xForm(function(x) {
	return Math.sin(Math.cos(x * 2) + Math.sin(x * 3) + x)
})

amusia.voices.silent = amusia.constant(0)

amusia.voices.violin = function(f, t) {
	var y = 0,
		A_total = 0
	
	for (var harm = 1; harm <= 7; ++harm) {
		var f2 = f * harm,
			A = 1 / harm
		
		A_total += A
		y += A * Math.sin(f2 * t * amusia.tau)
	}
	
	var res = y / A_total
	
	res *= (1 - 0.5 * Math.sin(amusia.tau * 6 * t)) // Add a low frequency amplitude modulation
	res *= (1 - Math.exp(-t * 3))
	
	return res
}

amusia.voices.clarinet = function(f, t) {
	var w = f * t * amusia.tau,
		sin = Math.sin
	
	// Odd harmonics
	var res = (sin(w) + 0.75*sin(w*3) + 0.5*sin(w*5)+0.14*sin(w*7)+0.5*sin(w*9)+0.12*sin(11*w)+0.17*sin(w*13))/(1+.75+.5+.14+.17)
	
	res *= Math.exp(t / 1.5)
	res *= Math.exp(-t * 1.5)
	
	return res
}

amusia.voices.sine_cubed = amusia.voice.exponentiate(amusia.voices.sine, 3)
amusia.voices.zapper_1_2 = amusia.voice.zapper(1 / 2)
amusia.voices.zapper_2_3 = amusia.voice.zapper(2 / 3)
amusia.voices.zapper_3_2 = amusia.voice.zapper(3 / 2)

amusia.voices.circular_split_zappy_2_3 = amusia.voice.split(amusia.voices.circular, amusia.voices.zapper_2_3)
amusia.voices.circular_mix_zappy_2_3 = amusia.voice.mix(amusia.voices.circular, amusia.voices.zapper_2_3)

amusia.memoize = function(func) {
	var cache = {}
	
	return function() {
		var args = [].slice.call(arguments),
			key = args.join(', '),
			res = cache[key]
		
		if (res == null) {
			cache[key] = res = func.apply(this, args)
		}
		
		return res
	}
}
