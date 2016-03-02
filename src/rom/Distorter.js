import {HORIZONTAL, HORIZONTAL_INTERLACED, VERTICAL} from "./DistortionEffect";
export default class Distorter {
	constructor(bitmap) {
		// There is some redundancy here: 'effect' is currently what is used
		// in computing frames, although really there should be a list of
		// four different effects ('dist') which are used in sequence.
		//
		// 'distortions' is currently unused, but ComputeFrame should be changed to
		// make use of it as soon as the precise nature of effect sequencing
		// can be determined.
		//
		// The goal is to make Distorter a general-purpose BG effect class that
		// can be used to show either a single distortion effect, or to show the
		// entire sequence of effects associated with a background entry (including
		// scrolling and Palette animation, which still need to be implemented).
// 		this.distortions = Array(4).fill(new DistortionEffect());
		this.bitmap = bitmap;
		this.original = null;
	}
	overlayFrame(dst, letterbox, ticks, alpha, erase) {
		let e = erase ? 1 : 0;
		return this.computeFrame(dst, this.bitmap, this.effect.type, letterbox, ticks, alpha, e, this.effect.amplitude, this.effect.amplitudeAcceleration, this.effect.frequency, this.effect.frequencyAcceleration, this.effect.compression, this.effect.compressionAcceleration, this.effect.speed);
	}
	/**
	* Evaluates the distortion effect at the given destination line and
	* time value and returns the computed offset value.
	* If the distortion mode is horizontal, this offset should be interpreted
	* as the number of pixels to offset the given line's starting x position.
	* If the distortion mode is vertical, this offset should be interpreted as
	* the y-coordinate of the line from the source bitmap to draw at the given
	* y-coordinate in the destination bitmap.
	* @param y
	* 	The y-coordinate of the destination line to evaluate for
	* @param t
	* 	The number of ticks since beginning animation
	* @return
	* 	The distortion offset for the given (y, t) coordinates
	*/
	getAppliedOffset(y, t, distortionEffect, ampl, ampl_accel, s_freq, s_freq_accel, compr, compr_accel, speed) {
		// N.B. another discrepancy from Java--these values should be "short," and
		// must have a specific precision. this seems to effect HORIZONTAL backgrounds
		let C1 = (1 / 512).toFixed(6);
		let C2 = (8.0 * Math.PI / (1024 * 256)).toFixed(6);
		let C3 = (Math.PI / 60).toFixed(6);
		// Compute "current" values of amplitude, frequency, and compression
		let amplitude = ampl + ampl_accel * t * 2;
		let frequency = s_freq + s_freq_accel * t * 2;
		let compression = compr + compr_accel * t * 2;
		// Compute the value of the sinusoidal line offset function
		let S = Math.round(C1 * amplitude * Math.sin((C2 * frequency * y + C3 * speed * t).toFixed(6)));
		if (distortionEffect === HORIZONTAL) {
			return S;
		}
		else if (distortionEffect === HORIZONTAL_INTERLACED) {
			return y % 2 === 0 ? -S : S;
		}
		else if (distortionEffect === VERTICAL) {
			let L = Math.floor(y * (1 + compression / 256) + S) % 256;
			if (L < 0) {
				L = 256 + L;
			}
			if (L > 255) {
				L = 256 - L;
			}
			return L;
		}
		return 0;
	}
	computeFrame(dst, src, distortionEffect, letterbox, ticks, alpha, erase, ampl, ampl_accel, s_freq, s_freq_accel, compr, compr_accel, speed) {
		let bdst = dst;
		let bsrc = src;
		// TODO: hardcoing is bad.
		let dstStride = 1024;
		let srcStride = 1024;
		/*
			Given the list of 4 distortions and the tick count, decide which
			effect to use:
			Basically, we have 4 effects, each possibly with a duration.
			Evaluation order is: 1, 2, 3, 0
			If the first effect is null, control transitions to the second effect.
			If the first and second effects are null, no effect occurs.
			If any other effect is null, the sequence is truncated.
			If a non-null effect has a zero duration, it will not be switched
			away from.
			Essentially, this configuration sets up a precise and repeating
			sequence of between 0 and 4 different distortion effects. Once we
			compute the sequence, computing the particular frame of which distortion
			to use becomes easy; simply mod the tick count by the total duration
			of the effects that are used in the sequence, then check the remainder
			against the cumulative durations of each effect.
			I guess the trick is to be sure that my description above is correct.
			Heh.
		*/
		let x = 0, y = 0;
		for (y = 0; y < 224; y++) {
			let S = this.getAppliedOffset(y, ticks, distortionEffect, ampl, ampl_accel, s_freq, s_freq_accel, compr, compr_accel, speed);
			let L = y;
			if (distortionEffect === 3) {
				L = S;
			}
			for (x = 0; x < 256; x++) {
				let bpos = x * 4 + y * dstStride;
				if (y < letterbox || y > 224 - letterbox) {
					bdst[bpos + 2] = 0;
					bdst[bpos + 1] = 0;
					bdst[bpos + 0] = 0;
					continue;
				}
				let dx = x;
				if (distortionEffect === HORIZONTAL || distortionEffect === HORIZONTAL_INTERLACED) {
					dx = (x + S) % 256;
					if (dx < 0) {
						dx = 256 + dx;
					}
					if (dx > 255) {
						dx = 256 - dx;
					}
				}
				let sPos = dx * 4 + L * srcStride;
				/* Either copy or add to the destination bitmap */
				if (erase) {
					bdst[bpos + 3] = 255;
					bdst[bpos + 2] = alpha * bsrc[sPos + 2];
					bdst[bpos + 1] = alpha * bsrc[sPos + 1];
					bdst[bpos + 0] = alpha * bsrc[sPos + 0];
				}
				else {
					bdst[bpos + 3] = 255;
					bdst[bpos + 2] += alpha * bsrc[sPos + 2];
					bdst[bpos + 1] += alpha * bsrc[sPos + 1];
					bdst[bpos + 0] += alpha * bsrc[sPos + 0];
				}
			}
		}
		return bdst;
	}
};
