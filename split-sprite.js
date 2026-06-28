const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function splitSpriteSheet(inputImagePath, rows = 3, cols = 3) {
    try {
        // Check if the provided file actually exists
        if (!fs.existsSync(inputImagePath)) {
            console.error(`Error: The file "${inputImagePath}" does not exist.`);
            process.exit(1);
        }

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const image = sharp(inputImagePath);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            throw new Error('Could not determine image dimensions.');
        }

        const spriteWidth = Math.floor(metadata.width / cols);
        const spriteHeight = Math.floor(metadata.height / rows);

        console.log(`Processing: ${inputImagePath}`);
        console.log(`Original image: ${metadata.width}x${metadata.height}`);
        console.log(`Each sprite will be: ${spriteWidth}x${spriteHeight}`);

        let count = 0;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const left = col * spriteWidth;
                const top = row * spriteHeight;

                const outputPath = path.join(outputDir, `sprite_${count}.png`);

                await image
                    .clone()
                    .extract({ left: left, top: top, width: spriteWidth, height: spriteHeight })
                    .toFile(outputPath);

                console.log(`Saved: ${outputPath}`);
                count++;
            }
        }

        console.log('Successfully split the sprite sheet!');

    } catch (error) {
        console.error('Error processing the image:', error);
    }
}

// Read the input file path from the command line arguments
const inputFile = process.argv[2];

// Validate that an input was provided
if (!inputFile) {
    console.error('Usage: node split-sprite.js <path-to-spritesheet>');
    console.error('Example: node split-sprite.js hero-sprites.png');
    process.exit(1);
}

// Run the function with the provided input file
splitSpriteSheet(inputFile, 3, 3);