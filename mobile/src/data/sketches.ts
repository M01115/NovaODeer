/**
 * Sample timed pencil sketches (generated in the team's scanned-pencil style), used as
 * past sketches in the archive until real uploads exist. Images are 640px-wide JPEGs in
 * assets/sketches; originals: Documents/Codex/2026-11-07/gene/outputs/timed-pencil-sketches.
 * Four are real hand sketches from the team's scan (扫描文稿.pdf): 05 water bottle,
 * 07 navigation device, 16 canopy bench and 18 lookout shelter.
 */
export type SampleSketch = {
  /** Short prompt shown on cards. */
  title: string;
  /** The prompt's id, when friends' sketches of it exist (data/friends.ts). */
  promptId?: string;
  /** The full drawing brief. */
  brief: string;
  emoji: string;
  /** Practice time in minutes. */
  minutes: number;
  /** Bundled image module (require result). */
  image: number;
};

export const SAMPLE_SKETCHES: SampleSketch[] = [
  { title: 'A cup', emoji: '☕', minutes: 0.5, brief: 'Draw a cup with an elliptical rim, two sides, and a curved base.', image: require('@/assets/sketches/01-cup.jpg') },
  { title: 'A power button', emoji: '⏻', minutes: 0.5, brief: 'Draw a circular button with a double outline and a power symbol.', image: require('@/assets/sketches/02-power-button.jpg') },
  { title: 'A storage box', emoji: '📦', minutes: 0.5, brief: 'Sketch a rectangular storage box with a lid seam in three-quarter view.', image: require('@/assets/sketches/03-storage-box.jpg') },
  { title: 'A flashlight', emoji: '🔦', minutes: 0.5, brief: 'Draw a simple flashlight with a cylindrical body and two rings around its lens.', image: require('@/assets/sketches/04-flashlight.jpg') },
  { title: 'A water bottle', emoji: '🧴', minutes: 0.5, brief: 'Sketch a water bottle using a rounded body, narrow neck, and screw cap.', image: require('@/assets/sketches/05-water-bottle.jpg') },
  { title: 'A canopy', emoji: '⛱️', minutes: 0.5, brief: 'Draw a sloping canopy using one roof plane and four thin support poles.', image: require('@/assets/sketches/06-canopy.jpg') },
  { title: 'A navigation device', emoji: '🧭', minutes: 2, brief: 'Sketch a circular navigation device with a winding route, direction arrow, and two buttons.', image: require('@/assets/sketches/07-navigation-device.jpg') },
  { title: 'A portable speaker', emoji: '🔊', minutes: 2, brief: 'Draw a portable speaker with a rectangular body, loosely indicated grille, and three top buttons.', image: require('@/assets/sketches/08-portable-speaker.jpg') },
  { title: 'A folding stool', emoji: '🪑', minutes: 2, brief: 'Sketch a folding stool with a fabric seat, crossed legs, and visible central hinges.', image: require('@/assets/sketches/09-folding-stool.jpg') },
  { title: 'A collapsible lantern', emoji: '🏮', minutes: 2, brief: 'Draw a collapsible lantern with elliptical rims, three accordion folds, and a curved handle.', image: require('@/assets/sketches/10-collapsible-lantern.jpg') },
  { title: 'A desk lamp', emoji: '💡', minutes: 2, brief: 'Sketch a desk lamp with a circular base, two jointed arms, and a cone-shaped shade.', image: require('@/assets/sketches/11-desk-lamp.jpg') },
  { title: 'A folding table', emoji: '🪵', minutes: 2, brief: 'Draw a folding table in perspective, showing its split tabletop and crossed supports.', image: require('@/assets/sketches/12-folding-table.jpg') },
  { title: 'An equipment case', emoji: '🧳', minutes: 2, brief: 'Draw a wheeled equipment case with an extended handle, lid seam, and two visible wheels.', image: require('@/assets/sketches/14-equipment-case.jpg') },
  { title: 'A camping chair', emoji: '🏕️', minutes: 5, brief: 'Sketch a folding camping chair with armrests and crossed supports. Add a small folded side view.', image: require('@/assets/sketches/15-camping-chair.jpg') },
  { title: 'A canopy bench', emoji: '🌳', minutes: 5, brief: 'Draw a bench beneath a sloping canopy. Include a main perspective and a small side view showing the roof angle.', image: require('@/assets/sketches/16-canopy-bench.jpg') },
  { title: 'A utility cart', emoji: '🛒', minutes: 5, brief: 'Sketch a utility cart with two wheels, a fabric compartment, and a hinged handle. Add a folded view.', image: require('@/assets/sketches/17-utility-cart.jpg') },
  { title: 'A lookout shelter', emoji: '🛖', minutes: 5, brief: 'Draw a raised lookout shelter with a roof, railings, support posts, and ladder. Add a small roof plan.', image: require('@/assets/sketches/18-lookout-shelter.jpg') },
  { title: 'A cooking station', emoji: '🍳', minutes: 5, brief: 'Sketch a portable cooking station with a folding worktop, lower shelf, and windscreen. Add one hinge detail.', image: require('@/assets/sketches/19-cooking-station.jpg') },
  { title: 'An outdoor workstation', emoji: '🛠️', minutes: 5, brief: 'Design an outdoor workstation combining a seat, folding table, and adjustable canopy. Show one main perspective and a small collapsed view.', image: require('@/assets/sketches/20-outdoor-workstation.jpg') },
  // Yesterday: the radio prompt, which friends drew too (data/friends.ts).
  { title: 'A small radio', promptId: 'radio', emoji: '📻', minutes: 0.5, brief: 'Draw a small radio with a speaker, tuning knob, handle, and antenna.', image: require('@/assets/sketches/13-portable-radio.jpg') },
];
