import fs from 'fs';
import path from 'path';

const rawNames = [
  "1	Yelo", "2	Blui", "3	Lumi", "4	Mova", "5	Orin", "6	Roko", "7	Pinko", 
  "8	Turi", "9	Vero", "10	Chroma", "11	Flowi", "12	Drizi", "13	Barko", 
  "14	Puffy", "15	Petli", "16	Grassi", "17	Breezo", "18	Monti", "19	Stono", 
  "20	Sunny", "21	Milki", "22	Lolli", "23	Choco", "24	Cupi", "25	Dono", 
  "26	Cooki", "27	Gelly", "28	Mallow", "29	Candyx", "30	Frosti", "31	Bytey", 
  "32	Metix", "33	Rollix", "34	Cablo", "35	Pixy", "36	Lumix", "37	Spinx", 
  "38	Butix", "39	Flexo", "40	Helmo", "41	Stari", "42	Kelpi", "43	Whaly", 
  "44	Bubbli", "45	Crabi", "46	Corli", "47	Jelly", "48	Finny", "49	Octi", 
  "50	Sharko", "51	Vortex", "52	Zeno", "53	Astro", "54	Comi", "55	Stelo", 
  "56	Luna", "57	Meteo", "58	Ufoy", "59	Orbit", "60	Nebu", "61	Labix", 
  "62	Copo", "63	Growy", "64	Beat", "65	Plushy", "66	Blazo", "67	Arti", 
  "68	Teachy", "69	Chefy", "70	Medix", "71	Flyo", "72	Button", "73	Zoomy", 
  "74	Stringo", "75	Toybot", "76	Bricko", "77	Traino", "78	Bouncy", "79	Blocky", 
  "80	Ballo", "81	Shroom", "82	Fae", "83	Drako", "84	Glowi", "85	Uni", 
  "86	Misty", "87	Gobi", "88	Crysta", "89	Spirio", "90	Magic", "91	Zenzo", 
  "92	Dashy", "93	Swimi", "94	Smashy", "95	Surfy", "96	Climbo", "97	Pedal", 
  "98	Kicko", "99	Dunky", "100	Punchy"
];

// Clean and create map
const namesMap = {};
rawNames.forEach(entry => {
  const [numStr, name] = entry.split(/\s+/);
  namesMap[parseInt(numStr, 10)] = name.trim();
});

const dir = path.join(process.cwd(), 'img', 'monsters');

let renamedCount = 0;
for (let i = 1; i <= 100; i++) {
  const oldPath = path.join(dir, `${i}.png`);
  if (fs.existsSync(oldPath)) {
    const newName = `${i}-${namesMap[i]}.png`;
    fs.renameSync(oldPath, path.join(dir, newName));
    renamedCount++;
  }
}

console.log(`Successfully renamed ${renamedCount} monster images.`);
