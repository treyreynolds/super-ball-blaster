export interface SubjectOption {
  id: string;
  name: string;
  dummyFacts: string[];
}

export const PRESET_SUBJECTS: SubjectOption[] = [
  {
    id: 'quantum',
    name: 'Quantum Computing',
    dummyFacts: [
      "In quantum computers, adding more qubits doesn't just add more processing power—it doubles it. Each additional qubit multiplies the computational power by 2, meaning a 300-qubit computer could perform more calculations simultaneously than there are atoms in the observable universe.",
      "Quantum computers are so sensitive to their environment that even cosmic rays from space can cause errors in calculations. Scientists have to shield them with special materials and cool them to temperatures colder than deep space.",
      "The 'quantum tunneling' effect means particles can literally pass through solid barriers they shouldn't be able to cross. It's like walking through a brick wall—and it happens in nature all the time, including in the fusion reactions that power the sun.",
      "Google's quantum computer completed a calculation in 200 seconds that would take the world's most powerful supercomputer 10,000 years, but here's the twist: some scientists argue it was actually solving a problem that has no practical use.",
      "Quantum entanglement is so bizarre that Einstein called it 'spooky action at a distance.' Two entangled particles can instantly affect each other even if they're on opposite sides of the galaxy, seemingly violating the speed of light.",
      "The first quantum computers weren't electronic at all—they used drops of liquid that could exist in multiple states at once. These 'NMR quantum computers' used the same technology as medical MRI machines.",
      "Quantum computers can't actually be observed while computing without destroying the calculation. The act of looking at a quantum system changes its state—imagine a library where opening any book instantly rewrites all the others.",
      "Some scientists believe quantum computers don't just perform calculations—they might be reaching into parallel universes to borrow processing power, according to the many-worlds interpretation of quantum mechanics.",
      "Quantum error correction is so complex that you need about 1,000 physical qubits to make one 'logical' qubit that can actually be used reliably. It's like needing a thousand slightly broken calculators to make one that works perfectly.",
      "The quantum Zeno effect shows that continuously observing a quantum system can freeze it in place, preventing it from changing—like the quantum version of the game 'Red Light, Green Light,' where particles are the players and measurement is the observer.",
      "Quantum teleportation has been achieved between Earth and a satellite 870 miles away, but here's the catch: no actual matter is transported—only the exact quantum state of a particle is transmitted.",
      "Some quantum computers require temperatures so close to absolute zero (-273.15°C) that they're actually the coldest human-made things in the universe, colder than the void of space itself.",
      "Quantum supremacy was achieved with just 53 qubits, but scaling up has proven so difficult that some scientists now believe practical quantum computers might be decades away—despite billions in investment.",
      "In quantum computing, a particle can spin both clockwise and counterclockwise simultaneously until measured. It's like having a coin that's both heads and tails until someone looks at it—and this property is key to their power.",
      "The largest quantum computer as of 2023 has 127 qubits, but due to quantum decoherence (where quantum states break down), most of these qubits can only maintain their quantum state for microseconds.",
      "Some researchers believe consciousness itself might be quantum mechanical, suggesting our brains might be running quantum computations. If true, we're all walking around with quantum computers in our heads.",
      "Quantum computers could break most modern encryption within hours, but they could also create unbreakable encryption methods. Countries are already storing encrypted data to decrypt it once quantum computers are powerful enough.",
      "The first quantum computer game was created in 2021, but ironically, it could only play a very simple version of Pong, despite the quantum computer being theoretically more powerful than classical supercomputers for certain tasks."
    ]
  },
  {
    id: 'supreme-court',
    name: 'Supreme Court',
    dummyFacts: [
      "The Supreme Court's basketball court, known as 'The Highest Court in the Land,' is located directly above the actual courtroom. Law clerks regularly play pick-up games there, but they have to wear non-marking shoes to avoid disturbing the justices below.",
      "When Justice Samuel Chase was impeached in 1804, he was accused of political bias—but continued to serve on the court during his own impeachment trial and even helped decide cases about impeachment law while under impeachment himself.",
      "The Supreme Court building has its own private underground train station, built during the Cold War so justices could be quickly evacuated. It's connected to a secret tunnel system beneath Capitol Hill that few people know exists.",
      "Justice William O. Douglas survived three assassination attempts and a plane crash, and still managed to serve the longest tenure in Supreme Court history—36 years and 7 months. He even continued to serve after suffering a debilitating stroke.",
      "The court's marble comes from quarries in Italy, Spain, and Africa, but surprisingly, some of it was quarried by prisoners in Alabama. The building contains so much marble that it actually began sinking into the ground and required structural reinforcement.",
      "Justice James Clark McReynolds was so anti-Semitic that he refused to speak to Justice Louis Brandeis for three years and would leave the room when Brandeis spoke. He also refused to sit next to Brandeis for the court's official photographs.",
      "The court's library contains a copy of the Nuremberg Trial transcripts signed by all the Nazi defendants before their executions. It's one of only three complete sets in North America.",
      "Until 1935, the court met in various locations, including a private house, a tavern, and the basement of the Capitol. When they finally got their own building, Chief Justice Taft had died before it was completed, but his widow secretly scattered his ashes in the cornerstone.",
      "There's a tradition of placing spittoons next to each Justice's chair in the courtroom, dating back to the tobacco-chewing days. They're still there today, though now they're used as wastepaper baskets worth about $500 each.",
      "Justice Sandra Day O'Connor maintained her Arizona cattle ranch license while serving on the court and would occasionally brand cattle during court recesses. She was known to say she was equally comfortable with legal briefs and cattle brands.",
      "The court's main entrance has an inscription reading 'Equal Justice Under Law,' but ironically, the bronze doors beneath it were so heavy that many people couldn't open them. They had to be mechanized in 2009 to comply with disability laws.",
      "During World War II, the Supreme Court building was secretly converted into a dormitory for soldiers, with cots placed in the Great Hall. The justices continued to work in the building while hundreds of soldiers slept there at night.",
      "Justice Benjamin Cardozo had such severe phone phobia that he refused to use telephones his entire life. His law clerks had to make all his calls, even personal ones, and he never once spoke on the court's internal phone system.",
      "The court's conference room table has a tradition where junior justices must answer the door and fetch coffee for the others. Elena Kagan joked that she got very good at coffee service during her early years on the court.",
      "When the court building opened in 1935, the justices were so uncomfortable with its grandeur that some refused to move in. Justice McReynolds called it 'almost bombastic' and Justice Van Devanter worried it would 'make us look too important.'",
      "There's a secret handshake that the justices perform before every conference, started by Chief Justice Melville Fuller in the 1800s to show that harmony prevailed among the justices despite their differences.",
      "The court's courtroom features hidden panels that can instantly seal it off from the rest of the building in case of emergency, complete with its own air supply and communications system—a post-9/11 addition that most visitors never notice."
    ]
  },
  {
    id: 'dead-religions',
    name: 'Dead Religions',
    dummyFacts: [
      "In the Aztec religion, the god Xipe Totec required priests to wear flayed human skin for 20 days straight until it rotted off. They believed this would ensure a bountiful harvest, and the practice was so important that they developed special skin-preservation techniques.",
      "The Carthaginian god Moloch was worshipped in a massive bronze statue with a furnace in its belly. Archaeological evidence suggests children were placed on the statue's heated hands, which would then tilt forward, dropping them into the fire while drums drowned out their screams.",
      "The Roman mystery cult of Mithras held services in underground temples designed to leak water during ceremonies. Initiates would stand under this 'blood of the bull' while a real bull was sacrificed on a grating above them—a literal baptism in blood.",
      "Ancient Egyptian priests had a practice called 'The Opening of the Mouth,' where they would surgically modify mummies' mouths because they believed the dead needed to eat, drink, and breathe in the afterlife. They even included instruction manuals in the tombs.",
      "The Mayans believed in a 'Death Ball Game' where losing teams were sacrificed, but here's the twist: being sacrificed was considered an honor, and evidence suggests elite players would sometimes deliberately lose to achieve divine status.",
      "In ancient Mesopotamia, priests practiced hepatoscopy—divination by reading sheep livers. They created intricate clay models of livers with detailed instructions, and some were so accurate they're still used to teach medical students about liver anatomy today.",
      "The Norse god Odin sacrificed himself to himself by hanging himself from the World Tree for nine days and nights. During this time, he also stabbed himself with his own spear—all to gain the knowledge of runes and magic.",
      "The Manichean religion believed that light particles were trapped in food, and eating released these particles. However, they thought procreation trapped more light in matter, so their elite priests would starve themselves and avoid reproduction to free the light.",
      "An ancient Chinese emperor became so obsessed with achieving immortality that he sent 1,000 young men and women to find a mythical island of immortals. They never returned, allegedly settling in Japan instead—some historians believe this might explain certain similarities between Japanese and Chinese culture.",
      "The Orphic mysteries taught that humans were created from the ashes of the Titans who had eaten Dionysus. This meant humans had both a divine nature (from Dionysus) and a corrupt nature (from the Titans), making them cosmic battlegrounds of good and evil.",
      "In the Etruscan religion, priests would draw sacred boundaries using a bronze plow and lift it at the points where they wanted gates to be. They believed breaking these boundaries would result in divine punishment, which influenced Roman city planning for centuries.",
      "The Phoenician goddess Tanit had temples where the walls were filled with thousands of urns containing the cremated remains of infant sacrifices. Recent DNA analysis suggests these were actually stillborn babies preserved for religious purposes rather than sacrificial victims.",
      "The Zoroastrian sky burial tradition involved leaving the dead on 'Towers of Silence' to be eaten by vultures. The practice continued in Mumbai until 2015, when it had to stop because India's vulture population had been decimated by agricultural chemicals.",
      "The Aztec goddess Tlazolteotl was the 'Eater of Filth' who could cleanse sins by consuming them. Once in their life, people could confess everything to her priests, but if they lied or confessed twice, they believed she would make their sins public in horrific ways.",
      "The Sumerian goddess Inanna's descent to the underworld required her to remove one piece of clothing or jewelry at each of seven gates, representing the stripping away of civilization. When she arrived, she was turned into a corpse and hung on a hook for three days.",
      "The Celtic Druids believed that writing their teachings down would rob them of their power, so they memorized up to 20 years worth of oral traditions. When the Romans destroyed their order, thousands of years of knowledge were lost forever.",
      "The Inca religion practiced capacocha, where children were taken to mountain peaks, given alcohol and coca leaves, and left to freeze to death. They believed these children didn't die but became messenger spirits to their gods. Some mummies have been found so well preserved that their organs were still intact.",
      "In ancient Egypt, some temples kept sacred geese that were believed to be able to detect lies. Priests would present two identical-looking pieces of bread to the accused, one normal and one marked with a secret prayer. If the goose ate the marked piece, the person was considered innocent."
    ]
  }
];