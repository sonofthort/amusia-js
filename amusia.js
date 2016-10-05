var amusia = {}

amusia.tau = 6.283185307179586476925286766559

// Some utils

amusia.def = function(obj, func) {
	func(obj)
	return obj
}

amusia.kv = function(obj, func) {
	for (var k in obj) {
		if (obj.hasOwnProperty(k)) {
			func(k, obj[k], obj)
		}
	}
}

amusia.mapObject = function(obj, func) {
	return amusia.def({}, function(res) {
		amusia.kv(obj, function(k, v) {
			res[k] = func(k, v, obj)
		})
	})
}

amusia.repeat = function(n, func) {
	for (var i = 0; i < n; ++i) {
		func(i, n)
	}
}

amusia.arraysEqual = function(a, b) {
	var length = a.length
	
	if (length !== b.length) {
		return false
	}
	
	for (var i = 0; i < length; ++i) {
		if (a[i] !== b[i]) {
			return false
		}
	}
	
	return true
}

amusia.randomBeat = function(rng) {
	return rng.nextElement([
		5,
		6, 6,
		7,
		8, 8, 8, 8,
		9, 9,
		10, 10,
		12, 12,
		16, 16
	])
}

amusia.randomNoteOdds = function(rng) {
	return rng.nextElement([2, 3])
}

amusia.scaleMaker = function(offsets) {
	return function(base, numOctaves) {
		numOctaves = numOctaves || 1
		
		var notes = []
		
		for (var i = 0; i < numOctaves; ++i) {
			offsets.forEach(function(offset) {
				notes.push(base + offset)
			})
			
			base += 12
		}
		
		return notes
	} 
}

amusia.chords = amusia.mapObject({
	major: [0, 4, 7],
	minor: [0, 3, 7],
	majorFlatFive: [0, 4, 6],
	majorFlatFive: [0, 4, 6],
	majorSix: [0, 4, 7, 9],
	minorSix: [0, 3, 7, 8],
	minorMajorSix: [0, 3, 7, 9],
	majorSeven: [0, 4, 7, 10],
	minorSeven: [0, 3, 7, 10],
	majorMajorSeven: [0, 4, 7, 11],
	minorMajorSeven: [0, 3, 7, 11],
	majorNine: [0, 2, 4, 7, 10],
	minorNine: [0, 2, 3, 7, 10],
	majorMajorNine: [0, 2, 4, 7, 11],
	minorMajorNine: [0, 2, 3, 7, 11],
	majorEleven: [0, 4, 5, 7, 10],
	minorEleven: [0, 3, 5, 7, 10],
	majorMajorEleven: [0, 4, 5, 7, 11],
	minorMajorEleven: [0, 3, 5, 7, 11],
	majorThirteen: [0, 4, 7, 9, 10],
	minorThirteen: [0, 3, 7, 9, 10],
	majorMajorThirteen: [0, 4, 7, 9, 11],
	minorMajorThirteen: [0, 3, 7, 9, 11],
	majorAddSecond: [0, 2, 4, 7],
	minorAddSecond: [0, 2, 3, 7],
	majorAddFourth: [0, 4, 5, 7],
	majorAddSharpFourth: [0, 4, 6, 7],
	minorAddSharpFourth: [0, 3, 6, 7],
	minorAddFourth: [0, 3, 5, 7],
	diminished: [0, 3, 6],
	diminishedSeventh: [0, 3, 6, 9],
	augmented: [0, 4, 8]
}, function(k, v) {
	return amusia.scaleMaker(v)
})

amusia.hasMatch = function(arr, pred) {
	var length = arr.length
	
	for (var i = 0; i < length; ++i) {
		if (pred(arr[i])) {
			return true
		}
	}
	
	return false
}

amusia.getMatches = function(arr, pred) {
	var length = arr.length,
		result = []
	
	for (var i = 0; i < length; ++i) {
		if (pred(arr[i])) {
			result.push(arr[i])
		}
	}
	
	return result
}

amusia.contains = function(arr, a) {
	return amusia.hasMatch(arr, function(b) {
		return a === b
	})
}

amusia.union = function(a, b) {
	return amusia.getMatches(a, amusia.contains.bind(null, b))
}

amusia.hasUnion = function(a, b) {
	return amusia.hasMatch(a, amusia.contains.bind(null, b))
}

amusia.modes = amusia.def([], function(modes) {
	;[	[0, 2, 4, 5, 7, 9, 11],
		[0, 2, 4, 5, 7, 8, 11],
		[0, 3, 6, 9],
		[0, 2, 3, 5, 7, 8, 11]].forEach(function(scale) {
		for (var i = 0; i < 12; ++i) {
			var modulated = scale.map(function(note) {
				return (note + i) % 12
			})
			
			var numModes = modes.length
			
			for (var j = 0; j < numModes; ++j) {
				if (amusia.arraysEqual(modes[j], modulated)) {
					break
				}
			}
			
			if (j === numModes) {
				modes.push(modulated)
			}
		}
	})
})

amusia.matchesMode = function(chord, mode) {
	return amusia.getMatches(chord, function(note) {
		return amusia.contains(mode, note % 12)
	}).length === chord.length
}

amusia.matchModes = function(chord) {
	return amusia.getMatches(amusia.modes, amusia.matchesMode.bind(null, chord))
}

amusia.scales = amusia.mapObject({
	major: [0, 2, 4, 5, 7, 9, 11],
	chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
}, function(k, v) {
	return amusia.scaleMaker(v)
})

amusia.randomChord = function(rng, scale, octaves) {
	scale = scale.slice()
	octaves = octaves || 1
	
	var numNotes = 3 + rng.nextInt(3),
		notes = []
	
	for (var i = 0; i < numNotes; ++i) {
		var index = rng.nextInt(scale.length),
			note = scale[index]
		
		scale.splice(index, 1)
		
		for (var octave = 0; octave < octaves; ++octave) {
			notes.push(note + 12 * octave)
		}
	}
	
	return notes
}

amusia.randomSubset = function(rng, notes, size) {
	notes = notes.slice()
	
	if (size >= notes.length) {
		return notes
	}
	
	var result = []
	
	for (var i = 0; i < size; ++i) {
		var index = rng.nextInt(notes.length)
		
		result.push(notes[index])
		notes[index] = notes.pop()
	}
	
	return result
}

// extract values of chords object
amusia.chordArray = amusia.def([], function(arr) {
	amusia.kv(amusia.chords, function(k, v) {
		arr.push(v)
	})
})

// create subset of chords by starting with a copy of the chord array
amusia.chordsToChooseFrom = amusia.chordArray.slice()

// then add more instances of certains chords
amusia.kv({
	major: 8,
	minor: 6,
	majorSeven: 4,
	majorMajorSeven: 2,
	minorSeven: 4,
	majorAddSecond: 4,
	minorAddSecond: 2,
	majorAddFourth: 2,
	minorAddFourth: 2,
	majorSix: 2,
	minorSix: 2
}, function(chordName, amount) {
	amusia.repeat(amount, function() {
		amusia.chordsToChooseFrom.push(amusia.chords[chordName])
	})
})

amusia.randChord = function(rng) {
	return rng.nextElement(amusia.chordsToChooseFrom)(13 + rng.nextInt(12))
}

amusia.getChordSet = function(rng, size, numOctaves, baseChords) {
	if (baseChords) {
		//do {
			var chord = rng.nextElement(baseChords)
		//} while (matchModes(chord).length > 4)
	} else {
		//do {
			var chord = amusia.randChord(rng)
		//} while (matchModes(chord).length > 4)
	}
	
	var chords = [chord],
		modes = amusia.matchModes(chord),
		allModes = [modes],
		end = size - 1
	
	for (var chordNum = 0; chordNum < end; ++chordNum) {
		var maxIterations = 1024
		for (var iteration = 0;; ++iteration) {
			//do {
				var nextChord = amusia.randChord(rng)
			//} while (dc.any(chords, dc.arrayEqual.bind(null, nextChord)))
			var nextModes = amusia.matchModes(nextChord),
				//req = rng.nextInt(16) === 0 ? 1 : 2
				req = rng.nextInt(8) > 0 ? 3 : rng.next(16) > 0 ? 2 : 1,
				numMatches = amusia.union(modes, nextModes).length
			
			if ((numMatches === req && !(numMatches === modes.length && modes.length === nextModes.length)) || iteration === maxIterations) {
				var duplicates = 0
				
				for (var i = 0; i < chordNum; ++i) {
					var m = allModes[i],
						numMatches = amusia.union(m, nextModes).length
					
					if (numMatches === m.length && m.length === nextModes.length) {
						++duplicates
					}
				}
				
				if (duplicates < 1 || iteration === maxIterations) {
					chords.push(nextChord)
					
					if (rng.nextInt(numMatches) !== 0) {
						modes = nextModes
					}
					
					allModes.push(modes)
					
					break
				}
			}
		}
	}
	
	var result = []
	
	--numOctaves
	
	chords.forEach(function(chord) {
		var notes = []
		
		for (var octave = 0; octave < numOctaves; ++octave) {
			chord.forEach(function(note) {
				notes.push(note + octave * 12)
			})
		}
		
		notes.push(notes[0] + numOctaves * 12)
		result.push(notes)
	})
	
	return result
}

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
		
		audio.src = this.toDataURI
		
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
		datas = waves.map(function(wave) {
			return wave.data
		}),
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

amusia.voices.silent = function(f, t) {
	return 0
}

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
		var args = [].slice.call(arguments)
		
		var key = args.join(', ')
		
		var res = cache[key]
		
		if (res == null) {
			cache[key] = res = func.apply(this, args)
		}
		
		return res
	}
}

amusia.constant = function(value) {
	return function() {
		return value
	}
}
