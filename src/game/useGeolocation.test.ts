import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from './useGeolocation';

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

describe('useGeolocation', () => {
	const watchFixes: PositionCallback[] = [];
	const currentFixes: PositionCallback[] = [];
	const getCurrentPosition = vi.fn(
		(
			success: PositionCallback,
			_error?: PositionErrorCallback | null,
			_options?: PositionOptions,
		) => currentFixes.push(success),
	);
	const watchPosition = vi.fn(
		(
			success: PositionCallback,
			_error?: PositionErrorCallback | null,
			_options?: PositionOptions,
		) => {
			watchFixes.push(success);
			return 7;
		},
	);
	const clearWatch = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
		watchFixes.length = 0;
		currentFixes.length = 0;
		getCurrentPosition.mockClear();
		watchPosition.mockClear();
		clearWatch.mockClear();
		window.history.replaceState({}, '', '/');
		Object.defineProperty(navigator, 'geolocation', {
			configurable: true,
			value: { getCurrentPosition, watchPosition, clearWatch },
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation);
		else Reflect.deleteProperty(navigator, 'geolocation');
	});

	it('keeps a high-accuracy watch warm and publishes its latest fix every five seconds', () => {
		const { result } = renderHook(() => useGeolocation());

		expect(result.current.watching).toBe(true);
		expect(watchPosition).toHaveBeenCalledTimes(1);
		expect(watchPosition.mock.calls[0][2]).toEqual({
			enableHighAccuracy: true,
			maximumAge: 5000,
			timeout: 30_000,
		});

		act(() =>
			watchFixes[0]({
				coords: { latitude: 42.3, longitude: -86.3, accuracy: 20 },
			} as GeolocationPosition),
		);
		expect(result.current.pos).toEqual({ lat: 42.3, lon: -86.3, accuracy: 20 });

		act(() =>
			watchFixes[0]({
				coords: { latitude: 42.31, longitude: -86.31, accuracy: 19 },
			} as GeolocationPosition),
		);
		act(() => vi.advanceTimersByTime(4999));
		expect(result.current.pos?.lat).toBe(42.3);
		act(() => vi.advanceTimersByTime(1));
		expect(result.current.pos).toEqual({ lat: 42.31, lon: -86.31, accuracy: 19 });
	});

	it('recenters only after a button-triggered fresh fix', () => {
		const { result } = renderHook(() => useGeolocation());

		act(() => result.current.locate());
		expect(result.current.locating).toBe(true);
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
		expect(getCurrentPosition.mock.calls[0][2]).toEqual({
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 25_000,
		});

		act(() =>
			currentFixes[0]({
				coords: { latitude: 42.31, longitude: -86.31, accuracy: 5 },
			} as GeolocationPosition),
		);
		expect(result.current.locating).toBe(false);
		expect(result.current.recenter).toMatchObject({ lat: 42.31, lon: -86.31, nonce: 1 });
	});
});
