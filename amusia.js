var amusia = {}

amusia.tau = 6.283185307179586476925286766559

amusia.util = {}

amusia.util.kv = function(obj, func) {
	for (var k in obj) {
		if (obj.hasOwnProperty(k)) {
			func(k, obj[k], obj)
		}
	}
	
	return obj
}

amusia.Wave = function(args) {
	this.sampleRate = args.sampleRate ? args.sampleRate : 22050
	this.data = args.data ? args.data : []
	this.duration = args.duration ? args.duration : 0
	this.voice = args.voice
	this.volume = args.volume
	this.pan = args.pan
}

amusia.Wave.prototype = {
	addNote: function(frequency, seconds, voiceFunc, volumeFunc, panFunc) {
		voiceFunc = voiceFunc || this.voice
		volumeFunc = volumeFunc || this.volume
		panFunc = panFunc || this.pan
	
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
	addRest: function(seconds) {
		var data = this.data,
			numPoints = this.sampleRate * seconds
		
		for (var i = 0; i < numPoints; ++i) {
			data.push(0)
			data.push(0)
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
	return new amusia.Wave({
		sampleRate: data.sampleRate,
		data: data.data,
		duration: data.duration
	})
}

amusia.Wave.mix = function(waves, finalize) {
	var numWaves = waves.length,
		datas = waves.map(function(wave) {return wave.data}),
		minSize = datas[0].length,
		sampleRate = waves[0].sampleRate,
		duration = waves[0].duration
	
	for (var i = 1; i < numWaves; ++i) {
		if (waves[i].sampleRate !== sampleRate) {
			throw 'sampleRate mismatch'
		}
		
		minSize = Math.min(minSize, datas[i].length)
		duration = Math.min(duration, waves[i].duration)
	}
	
	var data,
		inverseNumWaves = 1 / numWaves
	
	if (finalize) {
		data = new Uint8Array(minSize)
	
		for (var i = 0; i < minSize; ++i) {
			var res = 0
			
			for (var j = 0; j < numWaves; ++j) {
				res += datas[j][i]
			}
			
			data[i] = Math.round(127 * res * inverseNumWaves) + 128
		}
	} else {
		data = new Array(minSize)
	
		for (var i = 0; i < minSize; ++i) {
			var res = 0
			
			for (var j = 0; j < numWaves; ++j) {
				res += datas[j][i]
			}
			
			data[i] = res * inverseNumWaves
		}
	}
	
	return new amusia.Wave({
		sampleRate: sampleRate,
		data: data,
		duration: duration
	})
}

amusia.Wave.concat = function(waves, bufferSeconds, finalize) {
	bufferSeconds = bufferSeconds ? bufferSeconds : 0

	var numWaves = waves.length,
		datas = waves.map(function(wave) {return wave.data}),
		sampleRate = waves[0].sampleRate,
		buffer = Math.floor(bufferSeconds * sampleRate * 2),
		duration = waves[0].duration + bufferSeconds,
		size = datas[0].length + buffer
	
	for (var i = 1; i < numWaves; ++i) {
		if (waves[i].sampleRate !== sampleRate) {
			throw 'sampleRate mismatch'
		}
		
		size += datas[i].length + buffer
		duration += waves[i].duration + bufferSeconds
	}
	
	var dataIndexBase = 0
	
	if (finalize) {
		var data = new Uint8Array(size)
	
		for (var i = 0; i < numWaves; ++i) {
			var waveData = datas[i],
				waveDataLength = waveData.length
			
			for (var j = 0; j < waveDataLength; ++j) {
				data[dataIndexBase + j] = Math.round(127 * waveData[j]) + 128
			}
			
			dataIndexBase += waveDataLength
			
			for (var j = 0; j < buffer; ++j) {
				data[dataIndexBase + j] = 128
			}
			
			dataIndexBase += buffer
		}
	} else {
		var data = new Array(size)
	
		for (var i = 0; i < numWaves; ++i) {
			var waveData = datas[i],
				waveDataLength = waveData.length
			
			for (var j = 0; j < waveDataLength; ++j) {
				data[dataIndexBase + j] = waveData[j]
			}
			
			dataIndexBase += waveDataLength
			
			for (var j = 0; j < buffer; ++j) {
				data[dataIndexBase + j] = 0
			}
			
			dataIndexBase += buffer
		}
	}
	
	return new amusia.Wave({
		sampleRate: sampleRate,
		data: data,
		duration: duration
	})
}

amusia.constant = function(value) {
	return function() {
		return value
	}
}

// returns a function that takes a numeric "note number", and converts it to its cooresponding frequency,
// in the requested temperament.
// ex: 0 = C, 1 = C#, 2 = D, etc
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

amusia.voice.mix = function(voices) {
	var numVoices = voices.length
	
	return function(f, t) {
		var total = 0
		
		for (var i = 0; i < numVoices; ++i) {
			total += voices[i](f, t)
		}
	
		return total / numVoices
	}
}

amusia.voice.exponentiate = function(voice, exponent) {
	return function(f, t) {
		return Math.pow(voice(f, t), exponent)
	}
}

// works best with rational exponents
amusia.voice.zapper = function(exponent) {
	return amusia.voice.xForm(function(x) {
		return Math.sin(x + Math.sin(Math.pow(x, exponent)))
	})
}

amusia.voice.waveSplit = function(voiceA, voiceB) {
	var sine = amusia.voices.sine
	
	return function(f, t) {
		return (sine(f, t) > 0 ? voiceA : voiceB)(f, t)
	}
}

amusia.voice.timeSplit = function(a, b, interval) {
	return function(f, t) {
		return ((t % f) > (interval * 0.5) ? a : b)(f, t)
	}
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

// find source of this
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

// https://pages.mtu.edu/~suits/clarinet.html
// ask for permission above before using this in proprietary software
amusia.voices.clarinet = function(f, t) {
	var w = f * t * amusia.tau,
		sin = Math.sin
	
	// Odd harmonics
	var res = (sin(w) + 0.75 * sin(w * 3) + 0.5 * sin(w * 5) + 0.14 * sin(w * 7) + 0.5 * sin(w * 9) + 0.12 * sin(11 * w) + 0.17 * sin(w * 13)) / (1 + .75 + .5 + .14 + .17)
	
	res *= Math.exp(t / 1.5)
	res *= Math.exp(-t * 1.5)
	
	return res
}

amusia.voices.sine_cubed = amusia.voice.exponentiate(amusia.voices.sine, 3)
amusia.voices.zapper_1_2 = amusia.voice.zapper(1 / 2)
amusia.voices.zapper_2_3 = amusia.voice.zapper(2 / 3)
amusia.voices.zapper_3_2 = amusia.voice.zapper(3 / 2)

amusia.voices.circular_split_zappy_2_3 = amusia.voice.waveSplit(amusia.voices.circular, amusia.voices.zapper_2_3)
amusia.voices.circular_mix_zappy_2_3 = amusia.voice.timeSplit(amusia.voices.circular, amusia.voices.zapper_2_3)

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

amusia.chord = function(args) {
	var notes = args.notes.slice(),
		numNotes = notes.length,
		notesPerOctave = args.notesPerOctave
		
	return {
		serialize: function() {
			return {
				notes: notes.slice(),
				notesPerOctave: notesPerOctave
			}
		},
		invertUp: function() {
			var invertedNotes = new Array(numNotes)
				
			for (var i = 1; i < numNotes; ++i) {
				invertedNotes[i - 1] = notes[i]
			}
			
			invertedNotes[numNotes - 1] = notes[0] + notesPerOctave
			
			return amusia.chord({
				notes: invertedNotes,
				notesPerOctave: notesPerOctave
			})
		},
		invertDown: function() {
			var invertedNotes = new Array(numNotes)
				
			for (var i = 1; i < numNotes; ++i) {
				invertedNotes[i] = notes[i - 1]
			}
			
			invertedNotes[0] = notes[numNotes - 1] - notesPerOctave
			
			return amusia.chord({
				notes: invertedNotes,
				notesPerOctave: notesPerOctave
			})
		},
		append: function(extraNotes) {
			if (typeof extraNotes === 'number') {
				extraNotes = [].slice.call(arguments)
			}
		
			var appendedNotes = notes.slice()
			
			extraNotes.forEach(function(note) {
				appendedNotes.push(note)
			})
			
			return amusia.chord({
				notes: appendedNotes,
				notesPerOctave: notesPerOctave
			})
		},
		transpose: function(n) {
			return amusia.chord({
				notes: notes.map(function(note) {
					return note + n
				}),
				notesPerOctave: notesPerOctave
			})
		},
		sort: function() {
			return amusia.chord({
				notes: notes.slice().sort(),
				notesPerOctave: notesPerOctave
			})
		},
		extend: function(numOctaves) {
			var extendedNotes = []
			
			for (var i = 0; i <= numOctaves; ++i) {
				var offset = i * notesPerOctave
				
				for (var j = 0; j < numNotes; ++j) {
					extendedNotes.push(notes[j] + offset)
				}
			}
			
			extendedNotes.push(notes[0] + numOctaves * notesPerOctave)
			
			return amusia.chord({
				notes: extendedNotes,
				notesPerOctave: notesPerOctave
			})
		},
		flipIntervals: function() {
			return amusia.chord({
				notes: notes.map(function(note) {
					return notesPerOctave - note
				}).sort(),
				notesPerOctave: notesPerOctave
			})
		},
		notes: function() {
			return notes.slice()
		},
		transposeOctave: function(n) {
			var offset = notesPerOctave * n
			
			return amusia.chord({
				notes: notes.map(function(note) {
					return note + offset
				}),
				notesPerOctave: notesPerOctave
			})
		}
	}
}

amusia.chords = {
	major: amusia.chord({
		notes: [0, 4, 7],
		notesPerOctave: 12
	}),
	minor: amusia.chord({
		notes: [0, 3, 7],
		notesPerOctave: 12
	}),
	diminished: amusia.chord({
		notes: [0, 3, 6],
		notesPerOctave: 12
	}),
	augmented: amusia.chord({
		notes: [0, 4, 8],
		notesPerOctave: 12
	}),
	flat5: amusia.chord({
		notes: [0, 4, 6],
		notesPerOctave: 12
	}),
	sus2: amusia.chord({
		notes: [0, 2, 7],
		notesPerOctave: 12
	}),
	sus4: amusia.chord({
		notes: [0, 5, 7],
		notesPerOctave: 12
	})
}

amusia.chords.major7 = amusia.chords.major.append(10)
amusia.chords.majorMajor7 = amusia.chords.major.append(11)
amusia.chords.majorAdd2 = amusia.chords.major.append(2).sort()
amusia.chords.majorAdd4 = amusia.chords.major.append(5).sort()
amusia.chords.major7Add2 = amusia.chords.major7.append(2).sort()
amusia.chords.majorMajor7Add2 = amusia.chords.majorMajor7.append(2).sort()
amusia.chords.major7Add4 = amusia.chords.major7.append(5).sort()
amusia.chords.majorMajor7Add4 = amusia.chords.majorMajor7.append(5).sort()
amusia.chords.major6 = amusia.chords.major.append(9)
amusia.chords.majorMinor6 = amusia.chords.major.append(8)
amusia.chords.major9 = amusia.chords.major7.append(14)
amusia.chords.majorMajor9 = amusia.chords.majorMajor7.append(14)
amusia.chords.major11 = amusia.chords.major7.append(17)
amusia.chords.majorMajor11 = amusia.chords.majorMajor7.append(17)

amusia.chords.minor7 = amusia.chords.minor.append(10)
amusia.chords.minorMajor7 = amusia.chords.minor.append(11)
amusia.chords.minorAdd2 = amusia.chords.minor.append(2).sort()
amusia.chords.minorAdd4 = amusia.chords.minor.append(5).sort()
amusia.chords.minor7Add2 = amusia.chords.minor7.append(2).sort()
amusia.chords.minorMajor7Add2 = amusia.chords.minorMajor7.append(2).sort()
amusia.chords.minor7Add4 = amusia.chords.minor7.append(5).sort()
amusia.chords.minorMajor7Add4 = amusia.chords.minorMajor7.append(5).sort()
amusia.chords.minorMajor6 = amusia.chords.minor.append(9)
amusia.chords.minor6 = amusia.chords.minor.append(8)
amusia.chords.minor9 = amusia.chords.minor7.append(14)
amusia.chords.minorMajor9 = amusia.chords.minorMajor7.append(14)
amusia.chords.minor11 = amusia.chords.minor7.append(17)
amusia.chords.minorMajor11 = amusia.chords.minorMajor7.append(17)

amusia.chords.diminished7 = amusia.chords.diminished.append(9)
amusia.chords.diminishedMinor7 = amusia.chords.diminished.append(10)
amusia.chords.diminishedMajor7 = amusia.chords.diminished.append(11)

amusia.chords.augmented7 = amusia.chords.augmented.append(10)
amusia.chords.augmentedMajor7 = amusia.chords.augmented.append(11)

amusia.song = {
	create: function(args) {
		var chords = {}
		
		amusia.util.kv(amusia.chords, function(k, v) {
			chords[k] = v
		})
		
		if (args.chords) {
			var getChord = function(name) {
				var chord = chords[name]
				
				if (chord) {
					return chord
				}
				
				var chordArgs = args.chords[name]
				
				if (chordArgs) {
					if (chordArgs.base) {
						var base = getChord(chordArgs.base)
						
						if (base == null) {
							throw "unknown chord '" + chordArgs.base + "'"
						}
						
						chord = base
					} else {
						chord = amusia.chord({
							notes: chordArgs.notes,
							notesPerOctave: chordArgs.notesPerOctave ? chordArgs.notesPerOctave : 12
						})
					}
					
					if (chordArgs.transform) {
						chordArgs.transform.forEach(function(transformArgs) {
							if (chord.hasOwnProperty(transformArgs[0])) {
								chord = chord[transformArgs[0]](transformArgs[1])
							} else {
								throw "unknown transform '" + transformArgs[0] + "'"
							}
						})
					}
				}
				
				chords[name] = chord
				
				return chord
			}
		
			amusia.util.kv(args.chords, getChord)
		}
		
		var voices = {}
		
		amusia.util.kv(amusia.voices, function(k, v) {
			voices[k] = v
		})
		
		var chordProgressions = {}
		
		if (args.chordProgressions) {
			amusia.util.kv(args.chordProgressions, function(k, v) {
				chordProgressions[k] = v.map(function(chordName) {
					var chord = chords[chordName]
					
					if (chord == null) {
						throw "unknown chord '" + chordName + "'"
					}
					
					return chord
				})
			})
		}
	},
	deserialize: function(args) {
		
	}
}

amusia.SoundSpritePlayer = function(args) {
	var poolSize = args.poolSize ? args.poolSize : 4,
		volume = args.volume ? args.volume : 0.5,
		src = args.src ? args.src : '',
		sprites = args.sprites ? args.sprites : {},
		time = args.time ? args.time : 0
	
	this.pool = dc.generate(poolSize, function() {
		var audio = new Audio()
		
		audio.src = src
		audio.volume = volume
		
		return audio
	})
	
	this.activeAudios = []
	this.endTimes = []
	this.time = time
	this.sprites = sprites
}

amusia.SoundSpritePlayer.prototype = {
	play: function(name) {
		if (this.pool.length === 0) {
			var audio = this.activeAudios.shift()
			audio.pause()
			this.pool.push(audio)
			this.endTimes.shift()
		}
		
		var sprite = this.sprites[name]
		
		if (sprite == null) {
			return false
		}
		
		var audio = this.pool.pop()
		audio.pause()
		audio.currentTime = sprite.time
		audio.play()
		
		this.activeAudios.push(audio)
		this.endTimes.push(this.time + sprite.duration)
		
		return true
	},
	update: function(time) {
		this.time = time
		
		var activeAudios = this.activeAudios,
			endTimes = this.endTimes,
			pool = this.pool
		
		for (var i = activeAudios.length - 1; i >= 0; --i) {
			if (endTimes[i] <= time) {
				endTimes.pop()
				var audio = activeAudios.pop()
				audio.pause()
				pool.push(audio)
			}
		}
	},
	stop: function() {
		var time = this.time
		this.update(Number.POSITIVE_INFINITY)
		this.time = time
	}
}
