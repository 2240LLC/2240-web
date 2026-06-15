// js/catalogue.js — single source of truth for the archive.
// Add new entries to the TOP of this array. Mark the newest with isNew:true.
window.CATALOGUE = [
  {
    no: '001', id: 'tonsure', kind: 'Single', year: 2026, isNew: true,
    title: 'You Are The Man', artist: 'Tonsure', mode: 'tonsure',
    dur: null, tags: ['ambient'],
    audio: 'https://tb-sounds.2240.us/You%20Are%20The%20Man.wav',
    links: { Spotify: '', Apple: '', Bandcamp: '' },
  },
  {
    no: '002', id: 'washboard', kind: 'Single', year: 2026, isNew: false,
    title: 'Washboard', artist: 'Toby Brown', mode: 'washboard',
    dur: null, tags: ['folk'],
    audio: 'https://tb-sounds.2240.us/Washboard_MSTR_2448.wav',
    links: { Spotify: '', Apple: '', Bandcamp: '' },
  },
  {
    no: '003', id: 'patient', kind: 'LP', year: 2022, isNew: false,
    title: 'The Patient', artist: 'Toby Brown', mode: 'patient',
    dur: null, tags: ['rock'],
    audio: null,
    links: { Spotify: '', Apple: '', Bandcamp: '' },
  },
  {
    no: '004', id: 'statues', kind: 'Dual Single', year: 2021, isNew: false,
    title: 'Is It Even Easier?', artist: 'Toby Brown', mode: 'statues',
    dur: null, tags: ['rock'],
    audio: null,
    links: { Spotify: '', Apple: '', Bandcamp: '' },
  },
];
