/**
 * data CLI Logo Display
 */

// Import oh-my-logo through the CommonJS bridge
import ohMyLogoBridge from './oh-my-logo-bridge.cjs';

/**
 * Display data logo with mountain theme
 */
async function displayLogo() {
  try {
    // Wait for the bridge to resolve the ES module
    const { renderFilled } = await ohMyLogoBridge;

    // All available oh-my-logo palettes
    const allPalettes = [
      'grad-blue',
      'sunset',
      'dawn',
      'nebula',
      'mono',
      'ocean',
      'fire',
      'forest',
      'gold',
      'purple',
      'mint',
      'coral',
      'matrix'
    ];

    // All available block fonts for filled mode
    const allFonts = [
      '3d',
      'block',
      'chrome',
      'grid',
      'huge',
      'pallet',
      'shade',
      'simple',
      'simple3d',
      'simpleBlock',
      'slick',
      'tiny'
    ];

    // Pick random palette AND random font - MAXIMUM CHAOS! 🎲
    const randomPalette = allPalettes[Math.floor(Math.random() * allPalettes.length)];
    const randomFont = allFonts[Math.floor(Math.random() * allFonts.length)];

    await renderFilled('Supa', {
      palette: randomPalette,
      font: randomFont // RANDOM FONT EVERY TIME! WHEEEEE! 🎉
    });
    await renderFilled('DATA', {
      palette: randomPalette,
      font: randomFont // RANDOM FONT EVERY TIME! WHEEEEE! 🎉
    });
  } catch {
    // Fallback: Simple console log if logo rendering fails
    console.log('D • A • T • A');
  }

  console.log('🖖 I am DATA:');
  console.log('Database Automation, Testing, and Alignment.');
  console.log('🤖 I am an Android. No, not the phone.');
  console.log('═══════════════════════════\n');
  console.log('');
  console.log('Computer, display the help menu.');
  console.log('');
  console.log('Displaying help menu.');
  console.log('');
  console.log('═══════════════════════════');
  console.log('');
}

export { displayLogo };
