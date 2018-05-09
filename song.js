amusia.song = {}

amusia.song.noteLookup = (function() {
	var res = {}
	
	var addNote = function(name, augment) {
		for (var octave = 0; octave < 12; ++octave) {
			var octaveStr = octave.toString(),
				value = augment + octave * 12
			
			res[name + octaveStr] = value
			res[name + 'b' + octaveStr] = value - 1
			res[name + 'bb' + octaveStr] = value - 2
			res[name + '#' + octaveStr] = value + 1
			res[name + '##' + octaveStr] = value + 2
		}
	}
	
	addNote('a', 0)
	addNote('b', 2)
	addNote('c', 3)
	addNote('d', 5)
	addNote('e', 7)
	addNote('f', 8)
	addNote('g', 10)
	addNote('A', 0)
	addNote('B', 2)
	addNote('C', 3)
	addNote('D', 5)
	addNote('E', 7)
	addNote('F', 8)
	addNote('G', 10)
	
	return res
})()

amusia.song.selectors = {
	sequence: function(n, i) {
		return i % n
	},
	curlicue: function(n, i, args) {
		return amusia.curlicueSelect(n, i, args.k)
	}
}

amusia.song.create = function(args) {
	var origDictionary = args.dictionary || {}
	
	var dictionaryReplace = function(value) {
		var replacements = 0
		
		var inner = function(v) {
			if (amusia.util.isString(v)) {
				var dictValue = origDictionary[v]
				
				if (dictValue == null) {
					dictValue = amusia.song.noteLookup[v]
				}
				
				if (dictValue != null) {
					++replacements
					return dictValue
				}
			} else if (amusia.util.isArray(v)) {
				return v.map(inner)
			} else if (amusia.util.isObject(v)) {
				var res = {}
				
				amusia.util.kv(v, function(l, w) {
					res[l] = inner(w)
				})
				
				return res
			}
			
			return v
		}
		
		var lastReplacements = replacements
		
		for (;;) {
			value = inner(value)
			
			if (lastReplacements === replacements) {
				break
			}
			
			lastReplacements = replacements
		}
		
		return value
	}
	
	var dictionary = dictionaryReplace(origDictionary),
		templates = dictionaryReplace(args.templates || {}),
		song = dictionaryReplace(args.song)
	
	var actualTemplateReplace = function(template, args) {
		var numArgs = args.length
		
		if (numArgs < 1) {
			throw 'missing template name'
		}
		
		var namedArgs = numArgs > 1 && amusia.util.isObject(args[1]) ? args[1] : {},
			templateName = args[0]
		
		var numReplaced = 0
		
		var inner = function(value) {
			if (amusia.util.isString(value)) {
				if (value.length > 4 && value.substring(0, 2) === '__' && value.substring(value.length - 2) == '__') {
					var key = value.substring(2, value.length - 2),
						index = parseInt(key)
						
					if (!isNaN(index)) {
						if (index > numArgs) {
							throw "template '" + templateName + "' missing argument " + key
						}
						
						++numReplaced
						return args[index]
					}
					
					var res = namedArgs[key]
					
					if (res == null) {
						throw "template '" + templateName + "' missing argument '" + key + "'"
					}
					
					++numReplaced
					return res
				}
			} else if (amusia.util.isArray(value)) {
				return value.map(inner)
			} else if (amusia.util.isObject(value)) {
				var res = {}
				
				amusia.util.kv(value, function(k, v) {
					res[k] = inner(v)
				})
				
				return res
			}
			
			return value
		}
		
		var res = template
		
		do {
			var lastNumReplacements = numReplaced
			res = inner(res)
		} while(numReplaced !== lastNumReplacements)
		
		return res
	}
	
	var templateReplace = function(value) {
		if (amusia.util.isArray(value)) {
			var res = value.map(templateReplace)
			
			if (res.length > 0 && amusia.util.isString(value[0])) {
				var template = templates[value[0]]
				
				if (template != null) {
					return templateReplace(actualTemplateReplace(template, res))
				}
			}
			
			return res
		} else if (amusia.util.isObject(value)) {
			var res = {}
			
			amusia.util.kv(value, function(k, v) {
				res[k] = templateReplace(v)
			})
			
			return res
		}
		
		return value
	}
	
	song = templateReplace(song)
		
	var defaultSelector = {
		type: 'sequence'
	}
	
	var idStore = {}

	var compile = function(arr, res) {
		res = res || []
		
		for (var i = 0, len = arr.length; i < len; ++i) {
			var value = arr[i]
			
			if (amusia.util.isString(value) || amusia.util.isNumber(value)) {
				res.push(value)
			} else if (amusia.util.isObject(value)) {
				var repeat = value.repeat != null ? value.repeat : 1
				
				if (value.group) {
					var selector = value.selector || defaultSelector,
						selectorFunc = amusia.song.selectors[selector.type]
					
					if (selectorFunc == null) {
						throw "unknown selector '" + selector.type + "'"
					}
					
					var group = value.group,
						currentI = selector.id != null ? (idStore[selector.id] || 0) : 0
					
					for (var j = 0; j < repeat; ++j) {
						compile([group[selectorFunc(group.length, j + currentI, selector)]], res)
					}
					
					if (selector.id != null) {
						idStore[selector.id] = j + currentI
					}
				} else {
					for (var j = 0; j < repeat; ++j) {
						var innerValue = value.value
						res.push(innerValue != null ? innerValue : value)
					}
				}
			} else {
				throw 'invalid song element type'
			}
		}
		
		return res
	}
	
	song = compile(song)
	
	var songLength = song.length,
		defaultVolume = args.volume != null ? args.volume : 0.5,
		defaultPan = args.pan || 0,
		baseTranspose = (args.transpose || 0) + (args.octave || 0) * 12,
		noteLength = args.noteLength || 1 / 8,
		currentVolume = 0,
		currentPan = 0,
		waves = []
	
	var currentVolumeFunc = function() {
		return currentVolume
	}
	
	var currentPanFunc = function() {
		return currentPan
	}
	
	// create waves
	for (var chordI = 0; chordI < songLength; ++chordI) {
		var voices = song[chordI].voices || [],
			numVoices = voices.length
		
		while (numVoices > waves.length) {
			waves.push(new amusia.Wave())
		}
	}
	
	var numWaves = waves.length
	
	for (var chordI = 0; chordI < songLength; ++chordI) {
		var chord = song[chordI],
			voices = chord.voices,
			numVoices = voices.length
			
		for (var voiceI = 0; voiceI < numVoices; ++voiceI) {
			var voice = voices[voiceI],
				notes = voice.notes,
				transpose = baseTranspose + (voice.transpose || 0) + (voice.octave || 0) * 12,
				volume = voice.volume != null ? voice.volume : defaultVolume,
				pan = voice.pan != null ? voice.pan : defaultPan,
				voiceNoteLength = voice.noteLength != null ? voice.noteLength : 1,
				selector = (voice.selector || defaultSelector),
				selectorType = selector.type,
				selectorFunc = amusia.song.selectors[selectorType]
				
			if (selectorFunc == null) {
				throw "unknown selector type '" + selectorType + "'"
			}
			
			var instrument = amusia.voices[voice.instrument]
			
			if (instrument == null) {
				throw "unknown instrument + '" + voice.instrument + "'"
			}
			
			if (chordI % voiceNoteLength === 0) {
				if (selector.id) {
					var currentI = idStore[selector.id] || 0,
						selectedI = selectorFunc(notes.length, currentI, selector)
					
					idStore[selector.id] = currentI + 1
				} else {
					var selectedI = selectorFunc(notes.length, chordI / voiceNoteLength, selector)
				}
				
				selectedI = (selectedI + (selector.offset || 0)) % notes.length
				
				if (selector.inverted) {
					selectedI = notes.length - selectedI - 1
				}
				
				var note = notes[selectedI] + transpose
				
				if (note != null) {
					currentVolume = volume
					currentPan = pan
					
					waves[voiceI].addNote(amusia.twelveToneEqualTemperament(note), noteLength * voiceNoteLength, instrument, currentVolumeFunc, currentPanFunc)
				} else {
					waves[waveI].addRest(noteLength * voiceNoteLength)
				}
			}
		}
		
		for (var waveI = voiceI; waveI < numWaves; ++waveI) {
			waves[waveI].addRest(noteLength)
		}
	}
	
	return amusia.Wave.mix(waves, args.finalize)
}
