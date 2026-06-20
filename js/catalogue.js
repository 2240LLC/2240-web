// js/catalogue.js — shared release catalogue (archive + sampler)
window.CATALOGUE = [
      {
        no: '2240-001', title: 'You Are The Man', artist: 'Tonsure',
        kind: 'Single', year: 2026, isNew: true,
        format: 'WAV', sampleRate: '48 kHz', bitDepth: '24-bit', license: 'CC BY 4.0',
        audio: 'https://tb-sounds.2240.us/You%20Are%20The%20Man.wav',
        peaks: 'audio/peaks/tonsure.json',
        sample: 'https://tb-sounds.2240.us/you-are-the-man.mp3',
        downloads: [
          { label: 'WAV · Free', url: 'https://tb-sounds.2240.us/You%20Are%20The%20Man.wav', fname: 'You Are The Man — Tonsure (2240-001).wav' },
        ],
        links: {
          'Spotify':     'https://open.spotify.com/track/2NEpdDyP44lIr60axDeHRJ',
          'Apple Music': 'https://music.apple.com/us/album/you-are-the-man/6778606462?i=6778606463',
          'Bandcamp':    'https://tobybrown.bandcamp.com/track/you-are-the-man',
          'Tidal':       'https://tidal.com/album/532119816/u',
        },
      },
      {
        no: '2240-002', title: 'Washboard', artist: 'Toby Brown',
        kind: 'Single', year: 2025, isNew: false,
        format: 'WAV', sampleRate: '48 kHz', bitDepth: '24-bit', license: 'CC BY 4.0',
        audio: 'https://tb-sounds.2240.us/Washboard_MSTR_2448.wav',
        peaks: 'audio/peaks/washboard.json',
        sample: 'https://tb-sounds.2240.us/washboard.mp3',
        downloads: [
          { label: 'WAV · Free', url: 'https://tb-sounds.2240.us/Washboard_MSTR_2448.wav', fname: 'Washboard — Toby Brown (2240-002).wav' },
        ],
        links: {
          'Spotify':     'https://open.spotify.com/track/4rguPdxBMk7NI8VJZ3Pp5z',
          'Apple Music': 'https://music.apple.com/us/album/washboard-single/1833580373',
          'Bandcamp':    'https://tobybrown.bandcamp.com/track/washboard',
          'Tidal':       'https://tidal.com/album/454247392/u',
        },
      },
      // 2240-003 / 004 — "Is It Even Easier?" dual single. R2 URLs are PREDICTED
      // from the uploaded filenames; confirm/correct after the R2 upload.
      {
        no: '2240-003', title: 'Dodge', artist: 'Toby Brown',
        kind: 'Single', year: 2021, isNew: false,
        format: 'WAV', sampleRate: '176.4 kHz', bitDepth: '24-bit', license: 'CC BY 4.0',
        audio: 'https://tb-sounds.2240.us/Dodge_48-24.wav',
        peaks: 'audio/peaks/dodge.json',
        sample: 'https://tb-sounds.2240.us/dodge.mp3',
        downloads: [
          { label: '48 kHz · 24-bit · Free', url: 'https://tb-sounds.2240.us/Dodge_48-24.wav', fname: 'Dodge — Toby Brown (2240-003) 48k-24.wav' },
          { label: '176.4 kHz master',        url: 'https://tb-sounds.2240.us/Dodge_Master1.5.wav', fname: 'Dodge — Toby Brown (2240-003) master.wav' },
        ],
        links: {
          'Spotify':     'https://open.spotify.com/album/5AN4wmOj3dysKgowSRwews',
          'Apple Music': 'https://music.apple.com/us/album/is-it-even-easier-single/1595173126',
          'Bandcamp':    'https://tobybrown.bandcamp.com/album/is-it-even-easier',
          'Tidal':       'https://tidal.com/album/204959504/u',
        },
      },
      {
        no: '2240-004', title: 'Half Capacity', artist: 'Toby Brown',
        kind: 'Single', year: 2021, isNew: false,
        format: 'WAV', sampleRate: '176.4 kHz', bitDepth: '24-bit', license: 'CC BY 4.0',
        audio: 'https://tb-sounds.2240.us/HalfCapacity_48-24.wav',
        peaks: 'audio/peaks/half-capacity.json',
        sample: 'https://tb-sounds.2240.us/half-capacity.mp3',
        downloads: [
          { label: '48 kHz · 24-bit · Free', url: 'https://tb-sounds.2240.us/HalfCapacity_48-24.wav', fname: 'Half Capacity — Toby Brown (2240-004) 48k-24.wav' },
          { label: '176.4 kHz master',        url: 'https://tb-sounds.2240.us/HalfCapacity_Master1.0.wav', fname: 'Half Capacity — Toby Brown (2240-004) master.wav' },
        ],
        links: {
          'Spotify':     'https://open.spotify.com/album/5AN4wmOj3dysKgowSRwews',
          'Apple Music': 'https://music.apple.com/us/album/is-it-even-easier-single/1595173126',
          'Bandcamp':    'https://tobybrown.bandcamp.com/album/is-it-even-easier',
          'Tidal':       'https://tidal.com/album/204959504/u',
        },
      },
    ];
