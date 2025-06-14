'use strict';

// ============================================================================
// Badge Handling
// ============================================================================

import {NEW_API, SERVER, IS_WEBKIT, IS_FIREFOX, WEBKIT_CSS as WEBKIT, DEBUG} from 'utilities/constants';

import {createElement, ManagedStyle} from 'utilities/dom';
import {has, makeAddonIdChecker, maybe_call, SourcedSet} from 'utilities/object';
import Module, { buildAddonProxy } from 'utilities/module';
import { ColorAdjuster } from 'utilities/color';
import { NoContent } from 'utilities/tooltip';

const CSS_BADGES = {
	1: {
		staff: { 1: { color: '#200f33', svg: true, trans: { color: '#6441a5' } } },
		admin: { 1: { color: '#faaf19', svg: true  } },
		global_mod: { 1: { color: '#0c6f20', svg: true } },
		broadcaster: { 1: { color: '#e71818', svg: true } },
		moderator: { 1: { color: '#34ae0a', svg: true } },
		twitchbot: { 1: { color: '#34ae0a' } },
		partner: { 1: { color: 'transparent', trans: { image: true, color: '#6441a5' } } },
		'clip-champ': { 1: { color: '#6441a5'} },

		vip: { 1: { color: '#b33ff0', trans: { color: 'transparent', invert: false}} },
		turbo: { 1: { color: '#6441a5', svg: true } },
		premium: { 1: { color: '#009cdc' } },

		subscriber: { 0: { color: '#6441a5' }, 1: { color: '#6441a5' }},
	},

	2: {
		staff: { 1: { color: '#000' } },
		admin: { 1: { color: '#DB7600' } },
		broadcaster: { 1: { color: '#E91916' } },
		moderator: { 1: { color: '#00AD03' } },
		global_mod: { 1: { color: '#006441' } },
		twitchbot: { 1: { color: '#00AD03' } },
		partner: { 1: { color: '#9146FF' } },

		subscriber: { 0: { color: '#8205B4'}, 1: { color: '#8205B4' } },

		vip: { 1: { color: '#E005B9' } },
		turbo: { 1: { color: '#59399A' } },
		premium: { 1: { color: '#00A0D6' } },
		'anonymous-cheerer': { 1: { color: '#4B367C' } },
		'clip-champ': { 1: { color: '#9146FF' } },
		'artist-badge': { 1: { color: '#1e69ff' } },
		'no_audio': { 1: { color: '#323239' } },
		'no_video': { 1: { color: '#323239' } }
	}
}

export const BADGE_POSITIONS = {
	staff: -2,
	admin: -1,
	global_mod: -1,
	broadcaster: 0,
	mod: 1,
	moderator: 1,
	twitchbot: 1,
	vip: 2,
	subscriber: 25
};


const NO_REPEAT = 'background-repeat:no-repeat;background-position:center;',
	BASE_IMAGE = `${SERVER}/static/badges/twitch/`,
	CSS_MASK_IMAGE = IS_WEBKIT ? 'webkitMaskImage' : 'maskImage',

	CSS_TEMPLATES = {
		0: data => `${data.fore ? `color:${data.fore};` : ''}background:${data.image||''} ${data.color};background-size:${data.scale*1.8}rem;${data.svg ? '' : `background-image:${data.image_set};`}${NO_REPEAT}`,
		1: data => `${CSS_TEMPLATES[0](data)}border-radius:${data.scale*.2}rem;`,
		2: data => `${CSS_TEMPLATES[0](data)}border-radius:${data.scale*.9}rem;background-size:${data.scale*1.6}rem;`,
		3: data => `${data.fore ? `color:${data.fore};` : ''}background:${data.color};border-radius:${data.scale*.9}rem;`,
		4: data => `${CSS_TEMPLATES[3](data)}height:${data.scale}rem;min-width:${data.scale}rem;`,
		5: data => `background:${data.image};background-size:${data.scale*1.8}rem;${data.svg ? `` : `background-image:${data.image_set};`}${NO_REPEAT}`,
		6: data => `background:linear-gradient(${data.color},${data.color});${WEBKIT}mask-image:${data.image};${WEBKIT}mask-size:${data.scale*1.8}rem ${data.scale*1.8}rem;${data.svg ? `` : `${WEBKIT}mask-image:${data.image_set};`}`
	};


export function generateOverrideCSS(data, style) {
	const urls = data.urls || {1: data.image},
		image = `url("${urls[1]}")`,
		image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`;

	if ( style === 3 || style === 4 )
		return '';

	if ( style === 6 )
		return `${WEBKIT}mask-image:${image} !important;${WEBKIT}mask-image:${image_set} !important;`;
	else
		return `background-image:${image} !important;background-image:${image_set} !important;`;
}


export function generateBadgeCSS(badge, version, data, style, is_dark, badge_version = 2, color_fixer, fg_fixer, scale = 1, clickable = false) {
	let color = data.color || 'transparent',
		fore = data.fore || is_dark ? '#fff' : '#000',
		base_image = data.image || (data.addon ? null : `${BASE_IMAGE}${badge_version}/${badge}${data.svg ? '.svg' : `/${version}/`}`),
		trans = false,
		invert = false,
		svg, image, image_set;

	if ( base_image && style > 4 ) {
		const td = data.trans || {};
		color = td.color || color;

		if ( td.image ) {
			trans = true;
			if ( td.image !== true )
				base_image = td.image;
		}

		if ( has(td, 'invert') )
			invert = td.invert && ! is_dark;
		else
			invert = style === 5 && ! is_dark;
	}

	if ( style === 3 || style === 4 ) {
		if ( color === 'transparent' && data.trans )
			color = data.trans.color || color;
	}

	if ( color === 'transparent' )
		style = 0;

	if ( base_image && style !== 3 && style !== 4 ) {
		svg = base_image.endsWith('.svg');
		if ( data.urls )
			image = `url("${data.urls[scale]}")`;
		else
			image = `url("${svg ? base_image : `${base_image}${scale}${trans ? '_trans' : ''}.png`}")`;

		if ( data.urls && scale === 1 ) {
			image_set = `${WEBKIT}image-set(${image} 1x${data.urls[2] ? `, url("${data.urls[2]}") 2x` : ''}${data.urls[4] ? `, url("${data.urls[4]}") 4x` : ''})`

		} else if ( data.urls && scale === 2 ) {
			image_set = `${WEBKIT}image-set(${image} 1x${data.urls[4] ? `, url("${data.urls[4]}") 2x` : ''})`;

		} else if ( ! svg && scale < 4 ) {
			if ( scale === 1 )
				image_set = `${WEBKIT}image-set(${image} 1x, url("${base_image}2${trans ? '_trans' : ''}.png") 2x, url("${base_image}4${trans ? '_trans' : ''}.png") 4x)`;

			else if ( scale === 2 )
				image_set = `${WEBKIT}image-set(${image} 1x, url("${base_image}4${trans ? '_trans' : ''}.png") 2x)`;

		} else
			image_set = image;
	}

	if ( color_fixer && color && color !== 'transparent' )
		color = color_fixer.process(color) || color;

	if ( fg_fixer && fore && fore !== 'transparent' && color !== 'transparent' ) {
		fg_fixer.base = color;
		fore = fg_fixer.process(fore) || fore;
	}

	if ( ! base_image ) {
		if ( style > 4 )
			style = 1;
		else if ( style > 3 )
			style = 2;
	}

	return `${clickable && (data.click_handler || data.click_url || data.click_action) ? 'cursor:pointer;' : ''}${invert ? 'filter:invert(100%);' : ''}${CSS_TEMPLATES[style]({
		scale: 1,
		color,
		fore,
		image,
		image_set,
		svg
	})}${data.css || ''}`;
}


export default class Badges extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
		this.inject('tooltips');
		this.inject('experiments');
		this.inject('staging');
		this.inject('load_tracker');

		this.style = new ManagedStyle('badges');

		// Bulk data structure for badges applied to a lot of users.
		// This lets us avoid allocating lots of individual user
		// objects when we don't need to do so.
		this.bulk = new Map;

		this._woofer_months = {};

		this.badges = {};
		this.twitch_badges = {};

		if ( IS_FIREFOX )
			this.settings.add('chat.badges.media-queries', {
				default: true,
				ui: {
					path: 'Chat > Badges >> tabs ~> Appearance',
					title: 'Use @media queries to support High-DPI Badge images in Mozilla Firefox.',
					description: 'This is required to see high-DPI badges on Firefox because Firefox still has yet to support `image-set()` after more than five years. It may be less reliable.',
					component: 'setting-check-box'
				}
			});

		this.settings.add('chat.badges.version', {
			default: 2,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Version',
				component: 'setting-select-box',
				data: [
					{value: 1, title: '1 (Pre December 2019)'},
					{value: 2, title: '2 (Current)'}
				]
			}
		});

		this.settings.add('chat.badges.clickable', {
			default: 2,
			process(ctx, val) {
				if (val === true)
					return 2;
				else if (val === false)
					return 0;
				return val;
			},
			ui: {
				path: 'Chat > Badges >> Behavior',
				title: 'Allow clicking badges.',
				description: 'Certain badges, such as Prime Gaming, act as links when this is enabled.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Legacy (Open URLs)'},
					{value: 2, title: 'Open Badge Card'}
				]
			}
		});

		this.settings.add('chat.badges.fix-colors', {
			default: true,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Adjust badge colors for visibility.',
				description: 'Ensures that badges are visible against the current background.\n\n**Note:** Only affects badges with custom rendering. Subscriber badges, bit badges, etc. are not affected.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.badges.hidden', {
			default: {},
			type: 'object_merge',
			ui: {
				path: 'Chat > Badges >> tabs ~> Visibility',
				title: 'Visibility',
				component: 'badge-visibility',
				getBadges: cb => this.getSettingsBadges(true, cb)
			}
		});

		this.settings.add('chat.badges.custom-mod', {
			default: true,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Use custom moderator badges where available.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.badges.custom-vip', {
			default: true,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Use custom VIP badges where available.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.badges.style', {
			default: 1,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Style',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Square'},
					{value: 1, title: 'Rounded'},
					{value: 2, title: 'Circular'},
					{value: 3, title: 'Circular (Color Only)'},
					{value: 4, title: 'Circular (Color Only, Small)'},
					{value: 5, title: 'Transparent'},
					{value: 6, title: 'Transparent (Colored)'}
				]
			}
		});

		this.handleClick = this.handleClick.bind(this);
	}

	getSettingsBadges(include_addons, callback) {
		const twitch = [],
			other = [],
			owl = [],
			tcon = [],
			game = [],
			ffz = [],
			specific_addons = {},
			addon = [];

		const twitch_keys = Object.keys(this.twitch_badges);
		if ( ! twitch_keys.length && callback ) {
			const td = this.resolve('site.twitch_data');
			if ( td )
				td.getBadges().then(data => {
					this.updateTwitchBadges(data);
					callback();
				});
		}

		for(const key in this.twitch_badges)
			if ( has(this.twitch_badges, key) ) {
				const badge = this.twitch_badges[key],
					vs = [];
				let v = badge && (badge[1] || badge[0]);

				for(const key in badge)
					if ( key !== '__cat' && has(badge, key) ) {
						const version = badge[key];
						if ( ! v )
							v = version;

						if ( version && version.image1x )
							vs.push({
								version: key,
								name: version.title,
								image: version.image1x,
								styleImage: `url("${version.image1x}")`
							});
					}

				if ( v ) {
					let cat;
					if ( badge.__cat === 'm-other' )
						cat = other;
					else if ( badge.__cat === 'm-owl' )
						cat = owl;
					else if ( badge.__cat === 'm-tcon' )
						cat = tcon;
					else if ( badge.__cat === 'm-game' )
						cat = game;
					else
						cat = twitch;

					cat.push({
						id: key,
						provider: 'twitch',
						name: v.title,
						color: 'transparent',
						image: v.image2x,
						versions: vs,
						styleImage: `url("${v.image2x}")`
					});
				}
			}

		if ( include_addons ) {
			const addon_badges_by_id = {};

			for(const [key, badge] of Object.entries(this.badges)) {
				if ( badge.no_visibility )
					continue;

				let image = badge.urls ? (badge.urls[2] || badge.urls[1]) : badge.image,
					image1x = badge.urls?.[1] || badge.image,
					color = badge.color || 'transparent';

				if ( ! badge.addon ) {
					image = `//cdn.frankerfacez.com/badge/${badge.id}/2/rounded`;
					image1x = `//cdn.frankerfacez.com/badge/${badge.id}/1/rounded`;
					color = 'transparent';
				}

				let store;
				if ( typeof badge.addon === 'string' )
					store = specific_addons[badge.addon] = specific_addons[badge.addon] || [];
				else
					store = badge.addon ? addon : ffz;

				let name = badge.title;
				let extra;
				try {
					extra = maybe_call(badge.tooltipExtra, this, null, badge);
				} catch(err) { extra = null; }
				if ( extra && !(extra instanceof Promise) )
					name = name + extra;

				const id = badge.base_id ?? key,
					is_this = id === key;
				let existing = addon_badges_by_id[id];

				if ( existing ) {
					if ( ! existing.versions )
						existing.versions = [{
							version: existing.key,
							name: existing.tipname,
							color: existing.color,
							image: existing.image1x,
							styleImage: `url("${existing.image1x}")`
						}];

					existing.versions.push({
						version: key,
						name,
						color,
						image: image1x,
						styleImage: `url("${image1x}")`
					});

					if ( is_this ) {
						existing.name = badge.title;
						existing.tipname = name;
						existing.color = color;
						existing.image = image;
						existing.styleImage = `url("${image}")`;
					}

				} else {
					existing = {
						id,
						key,
						provider: 'ffz',
						name: badge.title,
						tipname: name,
						color,
						image,
						image1x,
						styleImage: `url("${image}")`
					};

					if ( badge.base_id ) {
						existing.always_versions = true;
						existing.versions = [{
							version: existing.key,
							name: existing.tipname,
							color: existing.color,
							image: existing.image1x,
							styleImage: `url("${existing.image1x}")`
						}];
					}

					addon_badges_by_id[id] = existing;
					store.push(existing);
				}
			}
		}

		const out = [
			{title: 'Twitch', id: 'm-twitch', badges: twitch},
			{title: 'Twitch: TwitchCon', id: 'm-tcon', badges: tcon},
			{title: 'Twitch: Other', id: 'm-other', badges: other},
			{title: 'Twitch: Overwatch League', id: 'm-owl', badges: owl},
			{title: 'Twitch: Game', id: 'm-game', key: 'game', badges: game}
		];

		if ( ffz.length )
			out.push({title: 'FrankerFaceZ', id: 'm-ffz', badges: ffz});

		const addons = this.resolve('addons'),
			addon_chunks = [];

		for(const [key, val] of Object.entries(specific_addons)) {
			const addon = addons?.getAddon?.(key),
				title = addon?.short_name ?? addon?.name ?? key;

			addon_chunks.push({title: `Add-On: ${title}`, id: `m-addon-${key}`, badges: val});
		}

		addon_chunks.sort((a,b) => a.title.localeCompare(b.title));
		out.push(...addon_chunks);

		if ( addon.length )
			out.push({title: 'Add-on', id: 'm-addon', badges: addon});

		return out;
	}


	onEnable() {
		this.parent.context.on('changed:chat.badges.custom-mod', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.custom-vip', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.style', this.rebuildAllCSS, this);
		this.parent.context.on('changed:theme.is-dark', this.rebuildAllCSS, this);
		this.parent.context.on('changed:theme.tooltips-dark', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.version', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.media-queries', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.fix-colors', this.rebuildColoredBadges, this);
		this.parent.context.on('changed:chat.badges.clickable', this.rebuildAllCSS, this);

		this.rebuildAllCSS();
		this.loadGlobalBadges();

		this.on('chat:reload-data', flags => {
			if ( ! flags || flags.badges )
				this.loadGlobalBadges();
		});

		this.on('addon:fully-unload', addon_id => {
			let removed = 0;
			for(const [key, val] of Object.entries(this.badges)) {
				if ( val?.__source === addon_id ) {
					removed++;
					this.removeBadge(key, false);
				}
			}

			if ( removed ) {
				this.log.debug(`Cleaned up ${removed} entries when unloading addon:`, addon_id);
				this.generateBadgeCSS();
				// TODO: Debounced re-badge all chat messages.
			}
		});

		this.tooltips.types.badge = (target, tip) => {
			tip.add_class = 'ffz__tooltip--badges';

			const show_previews = this.parent.context.get('tooltip.badge-images');
			const ds = this.getBadgeData(target);

			if ( ds.data == null )
				return NoContent;

			const out = [];
			let promises = false;

			for(const d of ds.data) {
				let source_channel = null;
				if ( d.room ) {
					const source = this.resolve('site.chat')?.shared_room_data?.get(d.room);
					source_channel = source?.displayName;
					if (source_channel)
						source_channel = `\n\n${source_channel}`;
				}

				const p = d.provider;
				if ( p === 'twitch' ) {
					const bd = this.getTwitchBadge(d.badge, d.version, ds.room_id, ds.room_login),
						global_badge = this.getTwitchBadge(d.badge, d.version, null, null, true) || {};
					if ( ! bd )
						continue;

					let title = bd.title || global_badge.title;
					const tier = bd.tier || global_badge.tier;

					if ( d.data ) {
						if ( d.badge === 'subscriber' ) {
							if ( tier > 0 )
								title = this.i18n.t('badges.subscriber.tier-months', '{title}\n(Tier {tier}, {months, plural, one {# Month} other {# Months}})', {
									title,
									tier,
									months: d.data
								});
							else
								title = this.i18n.t('badges.subscriber.months', '{title}\n({count, plural, one {# Month} other {# Months}})', {
									title,
									count: d.data
								});
						} else if ( d.badge === 'founder' ) {
							title = this.i18n.t('badges.founder.months', '{title}\n(Subscribed for {count, plural, one {# Month} other {# Months}})', {
								title,
								count: d.data
							});
						}
					}

					out.push(<div class="ffz-badge-tip">
						{show_previews && <img class="preview-image ffz-badge" src={bd.image4x} />}
						{title}{source_channel}
					</div>);

				} else if ( p === 'ffz' ) {
					const full_badge = this.badges[d.id],
						badge = d.badge,
						extra = maybe_call(badge?.tooltipExtra ?? full_badge?.tooltipExtra, this, ds, badge, target, tip);

					if ( extra instanceof Promise ) {
						promises = true;
						out.push(extra.then(stuff => (<div class="ffz-badge-tip">
							{show_previews && d.image && <div
								class="preview-image ffz-badge"
								style={{
									backgroundColor: d.color,
									backgroundImage: `url("${d.image}")`
								}}
							/>}
							{d.title}{stuff||''}{source_channel}
						</div>)));

					} else
						out.push(<div class="ffz-badge-tip">
							{show_previews && d.image && <div
								class="preview-image ffz-badge"
								style={{
									backgroundColor: d.color,
									backgroundImage: `url("${d.image}")`
								}}
							/>}
							{d.title}{extra||''}{source_channel}
						</div>);
				}
			}

			if ( promises )
				return Promise.all(out);
			return out;
		}
	}

	// ========================================================================
	// Add-On Proxy
	// ========================================================================

	getAddonProxy(addon_id, addon, module) {
		if ( ! addon_id )
			return this;

		const is_dev = DEBUG || (addon?.dev ?? false),
			id_checker = makeAddonIdChecker(addon_id);

		const overrides = {},
			warnings = {};

		overrides.loadBadgeData = (badge_id, data, ...args) => {
			if ( data && data.addon === undefined )
				data.addon = addon_id;

			if ( is_dev && ! id_checker.test(badge_id) )
				module.log.warn('[DEV-CHECK] Call to chat.badges.loadBadgeData() did not include addon ID in badge_id:', badge_id);

			return this.loadBadgeData(badge_id, data, ...args);
		};

		if ( is_dev ) {
			overrides.removeBadge = (badge_id, ...args) => {
				// Note: We aren't checking that the badge_id contains the add-on
				// ID because that should be handled by loadBadgeData for badges
				// from this add-on. Checking if we're removing a badge from
				// another source covers the rest.

				const existing = this.badges[badge_id];
				if ( existing && existing.addon !== addon_id )
					module.log.warn('[DEV-CHECK] Removed un-owned badge with chat.badges.removeBadge():', badge_id, ' owner:', existing.addon ?? 'ffz');

				return this.removeBadge(badge_id, ...args);
			};

			overrides.setBulk = (source, ...args) => {
				if ( ! id_checker.test(source) )
					module.log.warn('[DEV-CHECK] Call to chat.badges.setBulk() did not include addon ID in source:', source);

				return this.setBulk(source, ...args);
			};

			overrides.deleteBulk = (source, ...args) => {
				if ( ! id_checker.test(source) )
					module.log.warn('[DEV-CHECK] Call to chat.badges.deleteBulk() did not include addon ID in source:', source);

				return this.deleteBulk(source, ...args);
			}

			overrides.extendBulk = (source, ...args) => {
				if ( ! id_checker.test(source) )
					module.log.warn('[DEV-CHECK] Call to chat.badges.extendBulk() did not include addon ID in source:', source);

				return this.extendBulk(source, ...args);
			}

			warnings.badges = 'Please use loadBadgeData() or removeBadge()';
		}

		return buildAddonProxy(module, this, 'chat.badges', overrides, warnings);
	}


	getBadgeData(target) {
		let container = target.parentElement?.parentElement;
		if ( ! container?.dataset?.roomId )
			container = target.closest('[data-room-id]');

		const room_id = container?.dataset?.roomId,
			room_login = container?.dataset?.room,

			user_id = container?.dataset?.userId,
			user_login = container?.dataset?.user;

		let data;
		if (target.dataset.badgeData )
			data = JSON.parse(target.dataset.badgeData);
		else {
			const badge_idx = target.dataset.badgeIdx;
			let message;

			if ( container.message )
				message = container.message;
			else {
				const fine = this.resolve('site.fine');

				if ( fine ) {
					message = container[fine.accessor]?.return?.stateNode?.props?.message;
					if ( ! message )
						message = fine.searchParent(container, n => n.props?.message)?.props?.message;
					if ( ! message && this.root.flavor === 'clips' ) {
						const lines = this.resolve('site.chat.line');
						const node = fine.searchParent(container, n => n.props?.node)?.props?.node;
						if ( lines && node )
							message = lines.messages.get(node);
					}
					if ( ! message )
						message = fine.searchParent(container, n => n.props?.node)?.props?.node?._ffz_message;
					if ( ! message )
						message = fine.searchParent(container, n => n.props?.messageContext)?.props?.messageContext?.comment?._ffz_message;
					if ( ! message )
						message = fine.searchParent(container, n => n._ffzIdentityMsg, 50)?._ffzIdentityMsg;
				}
			}

			if ( message?._ffz_message)
				message = message._ffz_message;
			if ( message )
				data = message.ffz_badge_cache?.[badge_idx]?.[1]?.badges;
		}

		return {
			room_id,
			room_login,
			user_id,
			user_login,
			data
		};
	}


	handleClick(event) {
		const mode = this.parent.context.get('chat.badges.clickable');
		if ( ! mode )
			return;

		const target = event.target;
		const ds = this.getBadgeData(target);

		if ( ds.data == null )
			return;

		let url = null;
		let click_badge = null;

		for(const d of ds.data) {
			const p = d.provider;
			if ( p === 'twitch' ) {
				const bd = this.getTwitchBadge(d.badge, d.version, ds.room_id, ds.room_login),
					global_badge = this.getTwitchBadge(d.badge, d.version, null, null, true) || {};
				if ( ! bd )
					continue;

				if ( mode == 1 && bd.click_url )
					url = bd.click_url;
				else if ( mode == 1 && global_badge.click_url )
					url = global_badge.click_url;
				else if ( mode == 1 && (bd.click_action === 'sub' || global_badge.click_action === 'sub') && ds.room_login )
					url = `https://www.twitch.tv/subs/${ds.room_login}`;
				else
					click_badge = bd;

				break;

			} else if ( p === 'ffz' ) {
				const badge = this.badges[target.dataset.badge];
				if ( badge?.click_handler ) {
					url = badge.click_handler(ds.user_id, ds.user_login, ds.room_id, ds.room_login, ds.data, event);
					break;
				}

				if ( badge?.click_url ) {
					url = badge.click_url;
					break;
				}
			}
		}

		if (click_badge) {
			const fine = this.resolve('site.fine');
			if (fine) {
				const line = fine.searchParent(target, n => n.openBadgeDetails && n.props?.message);
				if (line) {
					line.openBadgeDetails(click_badge, event);
					return;
				}
			}
		}

		if ( url ) {
			const link = createElement('a', {
				target: '_blank',
				rel: 'noopener noreferrer',
				href: url
			});
			link.click();
		}

		event.preventDefault();
	}


	cacheBadges(msg, skip_hide = false) {
		if ( msg.ffz_badge_cache )
			return msg.ffz_badge_cache;

		const hidden_badges = skip_hide ? {} : (this.parent.context.get('chat.badges.hidden') || {}),
			badge_style = this.parent.context.get('chat.badges.style'),
			custom_mod = this.parent.context.get('chat.badges.custom-mod'),
			custom_vip = this.parent.context.get('chat.badges.custom-vip'),
			is_mask = badge_style > 5,
			is_colored = badge_style !== 5,
			has_image = badge_style !== 3 && badge_style !== 4,

			tb = this.twitch_badges,

			slotted = new Map,
			twitch_badges = msg.badges || {},
			dynamic_data = msg.badgeDynamicData || {},

			//user = msg.user || {},
			//user_id = user.id,
			//user_login = user.login,
			room_id = msg.sourceRoomID ? msg.sourceRoomID : msg.roomID,
			room_login = msg.sourceRoomID ? null : msg.roomLogin,

			room = this.parent.getRoom(room_id, room_login, true),
			badges = msg.ffz_badges; // this.getBadges(user_id, user_login, room_id, room_login);

		let last_slot = 50, slot;

		for(const badge_id in twitch_badges)
			if ( has(twitch_badges, badge_id) ) {
				const version = twitch_badges[badge_id],
					is_hidden = hidden_badges[badge_id],
					bdata = tb && tb[badge_id],
					cat = bdata && bdata.__cat || 'm-twitch';

				if ( ! badge_id || is_hidden || (is_hidden == null && hidden_badges[cat]) )
					continue;

				if ( has(BADGE_POSITIONS, badge_id) )
					slot = BADGE_POSITIONS[badge_id];
				else
					slot = last_slot++;

				const data = dynamic_data[badge_id] || (badge_id === 'founder' && dynamic_data['subscriber']),
					mod_urls = badge_id === 'moderator' && custom_mod && room && room.data && room.data.mod_urls,
					vip_urls = badge_id === 'vip' && custom_vip && room && room.data && room.data.vip_badge,
					badges = [];

				if ( mod_urls ) {
					const bd = this.getTwitchBadge(badge_id, version, room_id, room_login);
					badges.push({
						provider: 'ffz',
						image: mod_urls[4] || mod_urls[2] || mod_urls[1],
						color: '#34ae0a',
						title: bd ? bd.title : 'Moderator',
						room: room_id,
						data
					});

				} else if ( vip_urls ) {
					const bd = this.getTwitchBadge(badge_id, version, room_id, room_login);
					badges.push({
						provider: 'ffz',
						image: vip_urls[4] || vip_urls[2] || vip_urls[1],
						color: 'transparent',
						title: bd ? bd.title : 'VIP',
						room: room_id,
						data
					});

				} else
					badges.push({
						provider: 'twitch',
						badge: badge_id,
						version,
						room: room_id,
						data
					});

				slotted.set(slot, {
					id: badge_id,
					props: {
						'data-provider': 'twitch',
						'data-badge': badge_id,
						'data-version': version,
						style: {}
					},
					badges
				});
			}

		if ( Array.isArray(badges) ) {
			const handled_ids = new Set;

			for(const badge of badges)
				if ( badge && badge.id != null ) {
					if ( handled_ids.has(badge.id) )
						continue;

					handled_ids.add(badge.id);

					const full_badge = this.badges[badge.id] || {},
						cat = typeof full_badge.addon === 'string'
							? `m-addon-${full_badge.addon}`
							: full_badge.addon
								? 'm-addon'
								: 'm-ffz',
						hide_key = badge.base_id ?? badge.id,
						is_hidden = hidden_badges[hide_key];

					if ( is_hidden || (is_hidden == null && hidden_badges[cat]) )
						continue;

					const slot = has(badge, 'slot') ? badge.slot : full_badge.slot,
						old_badge = slotted.get(slot),
						urls = badge.urls || (badge.image ? {1: badge.image} : null),
						color = badge.color || full_badge.color || 'transparent',
						no_invert = badge.no_invert,
						masked = color !== 'transparent' && is_mask,

						bu = (urls || full_badge.urls || {1: full_badge.image}),
						bd = {
							provider: 'ffz',
							id: badge.id,
							badge,
							room: badge.room,
							image: bu[4] || bu[2] || bu[1],
							color: badge.color || full_badge.color,
							title: badge.title || full_badge.title,
						};

					// Hacky nonsense.
					if ( ! full_badge.addon ) {
						bd.image = `//cdn.frankerfacez.com/badge/${badge.id}/4/rounded`;
						bd.color = null;
					}

					let style;

					if ( old_badge ) {
						old_badge.badges.push(bd);

						const replaces = has(badge, 'replaces') ? badge.replaces : full_badge.replaces,
							replaces_type = badge.replaces_type || full_badge.replaces_type;
						if ( replaces && (!replaces_type || replaces_type === old_badge.id) ) {
							old_badge.replaced = badge.id;
							old_badge.content = badge.content || full_badge.content || old_badge.content;
						} else
							continue;

						style = old_badge.props.style;

					} else if ( slot == null )
						continue;

					else {
						style = {};
						const props = {
							className: 'ffz-tooltip ffz-badge',
							'data-tooltip-type': 'badge',
							'data-provider': 'ffz',
							'data-badge': badge.id,
							style
						};

						slotted.set(slot, {
							id: badge.id,
							props,
							badges: [bd],
							content: badge.content || full_badge.content
						})
					}

					if (no_invert) {
						const old = slotted.get(slot);
						old.full_size = true;
						old.no_invert = true;

						style.background = 'unset';
						style.backgroundSize = 'unset';
						style[CSS_MASK_IMAGE] = 'unset';
					}

					if ( (has_image || color === 'transparent') && urls ) {
						const image = `url("${urls[1]}")`;
						let image_set;
						if ( urls[2] || urls[4] )
							image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`;

						style[masked && !no_invert ? CSS_MASK_IMAGE : 'backgroundImage'] = image;
						if ( image_set )
							style[masked && !no_invert ? CSS_MASK_IMAGE : 'backgroundImage'] = image_set;
					}

					if ( is_colored && badge.color ) {
						if ( masked && !no_invert )
							style.backgroundImage = `linear-gradient(${badge.color},${badge.color})`;
						else
							style.backgroundColor = badge.color;
					}
				}
		}

		return msg.ffz_badge_cache = Array.from(slotted).sort((a,b) => a[0] - b[0]);
	}


	render(msg, createElement, skip_hide = false, skip_click = false) {
		if ( ! msg.badges && ! msg.ffz_badges )
			return null;

		if ( ! msg.ffz_badge_cache )
			this.cacheBadges(msg, skip_hide);

		if ( ! msg.ffz_badge_cache.length )
			return null;

		const out = [];
		for(let i=0, l = msg.ffz_badge_cache.length; i < l; i++) {
			const data = msg.ffz_badge_cache[i][1],
				props = data.props;

			let content = maybe_call(data.content, this, data, msg, createElement);
			if ( content && ! Array.isArray(content) )
				content = [content];

			props.className = `ffz-tooltip ffz-badge${content ? ' tw-pd-x-05' : ''}${data.full_size ? ' ffz-full-size' : ''}${data.no_invert ? ' ffz-no-invert' : ''}`;
			props.key = `${props['data-provider']}-${props['data-badge']}`;
			props['data-tooltip-type'] = 'badge';
			props['data-badge-idx'] = i;
			//props['data-badge-data'] = JSON.stringify(data.badges);

			if ( ! skip_click )
				props.onClick = this.handleClick;

			if ( data.replaced )
				props['data-replaced'] = data.replaced;

			out.push(createElement('span', props, content || undefined));
		}

		return out;
	}


	rebuildColor() {
		if ( this.parent.context.get('chat.badges.fix-colors') ) {
			this.fg_fixer = new ColorAdjuster('#fff', 1, 4.5);
			this.color_fixer = new ColorAdjuster(
				this.parent.context.get('theme.is-dark') ? '#181818' : '#FFFFFF',
				1,
				2.5
			);
		} else {
			this.fg_fixer = null;
			this.color_fixer = null;
		}
	}


	rebuildColoredBadges() {
		this.rebuildColor();

		this.buildBadgeCSS();
		this.buildTwitchCSSBadgeCSS();
	}


	rebuildAllCSS() {
		this.rebuildColor();

		for(const room of this.parent.iterateRooms()) {
			room.buildBadgeCSS();
			room.buildModBadgeCSS();
		}

		this.buildBadgeCSS();
		this.buildTwitchBadgeCSS();
		this.buildTwitchCSSBadgeCSS();
	}


	// ========================================================================
	// Extension Badges
	// ========================================================================

	getBadges(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			global_user = this.parent.getUser(user_id, user_login, true);

		if ( global_user ) {
			user_id = user_id ?? global_user.id;
			user_login = user_login ?? global_user.login;
		}

		const room_user = room && room.getUser(user_id, user_login, true);

		const out = (global_user?.badges ? global_user.badges._cache : []).concat(
			room_user?.badges ? room_user.badges._cache.map(x => ({...x, room: room_id})) : []);

		if ( this.bulk.size ) {
			const str_user = String(user_id);
			for(const [badge_id, users] of this.bulk) {
				if ( users?._cache.has(str_user) )
					out.push({id: badge_id});
			}
		}

		return out;
	}


	setBulk(source, badge_id, entries) {
		let set = this.bulk.get(badge_id);
		if ( ! set )
			this.bulk.set(badge_id, set = new SourcedSet(true));

		set.set(source, entries);
	}

	deleteBulk(source, badge_id) {
		const set = this.bulk.get(badge_id);
		if ( set )
			set.delete(source);
	}

	extendBulk(source, badge_id, entries) {
		let set = this.bulk.get(badge_id);
		if ( ! set )
			this.bulk.set(badge_id, set = new SourcedSet(true));

		if ( ! Array.isArray(entries) )
			entries = [entries];

		set.extend(source, ...entries);
	}


	async loadGlobalBadges(tries = 0) {
		this.load_tracker.schedule('chat-data', 'ffz-global-badges');

		let response, data;

		if ( this.experiments.getAssignment('api_load') && tries < 1 )
			try {
				fetch(`${NEW_API}/v1/badges/ids`).catch(() => {});
			} catch(err) { /* do nothing */ }

		try {
			response = await fetch(`${this.staging.api}/v1/badges/ids`);
		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.loadGlobalBadges(tries), 500 * tries);

			this.log.error('Error loading global badge data.', err);
			this.load_tracker.notify('chat-data', 'ffz-global-badges', false);
			return false;
		}

		if ( ! response.ok ) {
			this.load_tracker.notify('chat-data', 'ffz-global-badges', false);
			return false;
		}

		try {
			data = await response.json();
		} catch(err) {
			this.log.error('Error parsing global badge data.', err);
			this.load_tracker.notify('chat-data', 'ffz-global-badges', false);
			return false;
		}

		let badges = 0, users = 0;

		if ( data.badges )
			for(const badge of data.badges)
				if ( badge && badge.id ) {
					this.loadBadgeData(badge.id, badge, false);
					badges++;
				}

		if ( data.users )
			for(const badge_id in data.users)
				if ( has(data.users, badge_id) ) {
					const badge = this.badges[badge_id],
						name = badge?.name;
					let c = 0;

					if ( name === 'supporter' || name === 'subwoofer' || name === 'bot' ) {
						this.setBulk('ffz-global', badge_id, data.users[badge_id].map(x => String(x)));
						/*this.supporter_id = badge_id;
						for(const user_id of data.users[badge_id])
							this.supporters.add(`${user_id}`);*/

						c = data.users[badge_id].length; // this.supporters.size;
					} else
						for(const user_id of data.users[badge_id]) {
							const user = this.parent.getUser(user_id, undefined);
							if ( user.addBadge('ffz-global', badge_id) ) {
								c++;
								users++;
							}
						}

					if ( c > 0 )
						this.log.info(`Added "${badge ? badge.name : `#${badge_id}`}" to ${c} users.`);
				}

		this.log.info(`Loaded ${badges} badges and assigned them to ${users} users.`);
		this.buildBadgeCSS();
		this.load_tracker.notify('chat-data', 'ffz-global-badges');
	}


	getBadge(badge_id) {
		return this.badges[badge_id] ?? null;
	}


	removeBadge(badge_id, generate_css = true) {
		if ( ! this.badges[badge_id] )
			return;

		delete this.badges[badge_id];

		if ( generate_css )
			this.buildBadgeCSS();
	}


	loadBadgeData(badge_id, data, generate_css = true) {
		this.badges[badge_id] = data;

		if ( data ) {
			if ( data.addon === undefined )
				data.addon =/^addon/.test(badge_id);

			if ( data.replaces && ! data.replaces_type ) {
				data.replaces_type = data.replaces;
				data.replaces = true;
			}

			if ( ! data.addon && (data.name === 'developer' || data.name === 'subwoofer' || data.name === 'supporter') )
				data.click_url = 'https://www.frankerfacez.com/subscribe';

			if ( ! data.addon && (data.name === 'subwoofer') ) {
				data.base_id = data.id;

				data.tooltipExtra = data => {
					if ( ! data?.user_id )
						return null;

					return this.getSubwooferMonths(data.user_id)
						.then(d => {
							if ( ! d?.months )
								return;

							if ( d.lifetime )
								return `\n${  this.i18n.t('badges.subwoofer.lifetime', 'Lifetime Subwoofer')}`;

							return `\n${  this.i18n.t('badges.subwoofer.months', '({count, plural, one {# Month} other {# Months}})', {
								count: d.months
							})}`;
						})
				};
			}
		}

		if ( generate_css )
			this.buildBadgeCSS();
	}


	getSubwooferMonths(user_id) {
		let info = this._woofer_months[user_id];
		if ( info instanceof Promise )
			return info;

		const expires = info?.expires;
		if ( expires && Date.now() >= expires )
			info = this._woofer_months[user_id] = null;

		if ( info?.value )
			return Promise.resolve(info.value);

		return this._woofer_months[user_id] = fetch(`https://api.frankerfacez.com/v1/_user/id/${user_id}`)
			.then(resp => resp.ok ? resp.json() : null)
			.then(data => {
				let out = null;
				if ( data?.user?.sub_months )
					out = {
						months: data.user.sub_months,
						lifetime: data.user.sub_lifetime
					};

				this._woofer_months[user_id] = {
					expires: Date.now() + (5 * 60 * 1000),
					value: out
				};

				return out;
			})
			.catch(err => {
				console.error('Error getting subwoofer data for user', user_id, err);

				this._woofer_months[user_id] = {
					expires: Date.now() + (60 * 1000),
					value: null
				};

				return null;
			});
	}


	buildBadgeCSS() {
		const style = this.parent.context.get('chat.badges.style'),
			is_dark = this.parent.context.get('theme.is-dark'),
			can_click = this.parent.context.get('chat.badges.clickable'),
			use_media = IS_FIREFOX && this.parent.context.get('chat.badges.media-queries');

		const out = [];
		for(const key in this.badges)
			if ( has(this.badges, key) ) {
				const data = this.badges[key],
					selector = `.ffz-badge[data-badge="${key}"]`;

				out.push(`.ffz-badge[data-replaced="${key}"]{${generateOverrideCSS(data, style, is_dark)}}`);

				if ( use_media ) {
					out.push(`@media (max-resolution: 99dpi) {${selector}{${generateBadgeCSS(key, 0, data, style, is_dark, 0, this.color_fixer, this.fg_fixer, 1, can_click)}}}`);
					out.push(`@media (min-resolution: 100dpi) and (max-resolution:199dpi) {${selector}{${generateBadgeCSS(key, 0, data, style, is_dark, 0, this.color_fixer, this.fg_fixer, 2, can_click)}}}`);
					out.push(`@media (min-resolution: 200dpi) {${selector}{${generateBadgeCSS(key, 0, data, style, is_dark, 0, this.color_fixer, this.fg_fixer, 4, can_click)}}}`);
				} else
					out.push(`${selector}{${generateBadgeCSS(key, 0, data, style, is_dark, 0, this.color_fixer, this.fg_fixer, undefined, can_click)}}`);
			}

		this.style.set('ext-badges', out.join('\n'));
	}


	// ========================================================================
	// Twitch Badges
	// ========================================================================

	getTwitchBadge(badge, version, room_id, room_login, retried = false) {
		const room = this.parent.getRoom(room_id, room_login, true);
		let b;

		if ( room ) {
			const versions = room.badges && room.badges[badge];
			b = versions && versions[version];
		}

		if ( ! b ) {
			const versions = this.twitch_badges && this.twitch_badges[badge];
			b = versions && versions[version];
		}

		if ( ! b && ! retried ) {
			const chat = this.resolve('site.chat');
			if ( chat && chat.tryUpdateBadges )
				chat.tryUpdateBadges();
		}

		return b;
	}

	getTwitchBadgeCount() {
		return this.twitch_badge_count || 0;
	}

	updateTwitchBadges(badges) {
		this.twitch_badge_count = 0;
		if ( ! badges )
			this.twitch_badges = {};
		else if ( ! Array.isArray(badges) )
			this.twitch_badges = badges;
		else {
			let b = null;
			if ( badges.length ) {
				b = {};
				for(const data of badges) {
					const sid = data.setID,
						bs = b[sid] = b[sid] || {
							__cat: getBadgeCategory(sid)
						};

					this.twitch_badge_count++;
					bs[data.version] = fixBadgeData(data);
				}
			}

			this.twitch_badges = b;
		}

		this.buildTwitchBadgeCSS();
		this.buildTwitchCSSBadgeCSS();
	}


	buildTwitchCSSBadgeCSS() {
		const style = this.parent.context.get('chat.badges.style'),
			is_dark = this.parent.context.get('theme.is-dark'),
			can_click = this.parent.context.get('chat.badges.clickable'),
			use_media = IS_FIREFOX && this.parent.context.get('chat.badges.media-queries'),

			badge_version = this.parent.context.get('chat.badges.version'),
			versioned = CSS_BADGES[badge_version] || {},
			twitch_data = this.twitch_badges || {};

		const out = [];
		for(const key in versioned)
			if ( has(versioned, key) ) {
				const data = versioned[key],
					twitch = twitch_data[key];
				for(const version in data)
					if ( has(data, version) ) {
						const d = data[version],
							td = twitch?.[version],
							selector = `.ffz-badge[data-badge="${key}"][data-version="${version}"]`;

						if ( td && td.click_url )
							d.click_url = td.click_url;
						if ( td && td.click_action )
							d.click_action = td.click_action;

						if ( use_media ) {
							out.push(`@media (max-resolution: 99dpi) {${selector}{${generateBadgeCSS(key, version, d, style, is_dark, badge_version, this.color_fixer, this.fg_fixer, 1, can_click)}}}`);
							out.push(`@media (min-resolution: 100dpi) and (max-resolution:199dpi) {${selector}{${generateBadgeCSS(key, version, d, style, is_dark, badge_version, this.color_fixer, this.fg_fixer, 2, can_click)}}}`);
							out.push(`@media (min-resolution: 200dpi) {${selector}{${generateBadgeCSS(key, version, d, style, is_dark, badge_version, this.color_fixer, this.fg_fixer, 4, can_click)}}}`);
						} else
							out.push(`${selector}{${generateBadgeCSS(key, version, d, style, is_dark, badge_version, this.color_fixer, this.fg_fixer, undefined, can_click)}}`);
					}
			}

		this.style.set('css-badges', out.join('\n'));
	}


	buildTwitchBadgeCSS() {
		if ( ! this.twitch_badges )
			this.style.delete('twitch-badges');

		const badge_version = this.parent.context.get('chat.badges.version'),
			use_media = IS_FIREFOX && this.parent.context.get('chat.badges.media-queries'),
			can_click = this.parent.context.get('chat.badges.clickable'),
			versioned = CSS_BADGES[badge_version] || {};

		const out = [];
		for(const key in this.twitch_badges)
			if ( has(this.twitch_badges, key) ) {
				if ( has(versioned, key) )
					continue;

				const versions = this.twitch_badges[key];
				for(const version in versions)
					if ( has(versions, version) ) {
						const data = versions[version],
							selector = `.ffz-badge[data-badge="${key}"][data-version="${version}"]`;

						out.push(`${selector} {
			${can_click && (data.click_action || data.click_url) ? 'cursor:pointer;' : ''}
			background-color: transparent;
			filter: none;
			${WEBKIT}mask-image: none;
			background-size: 1.8rem;
			background-image: url("${data.image1x}");
			background-image: ${WEBKIT}image-set(
				url("${data.image1x}") 1x,
				url("${data.image2x}") 2x,
				url("${data.image4x}") 4x
			);
		}`);

						if ( use_media ) {
							out.push(`@media (min-resolution: 100dpi) and (max-resolution:199dpi) { ${selector} {
								background-image: url("${data.image2x}");
							}}`);
							out.push(`@media (min-resolution: 200dpi) { ${selector} {
								background-image: url("${data.image4x}");
							}}`);
						}
					}
			}

		if ( out.length )
			this.style.set('twitch-badges', out.join('\n'));
		else
			this.style.delete('twitch-badges');
	}
}


const OTHER_BADGES = [
	'vga-champ-2017',
	'warcraft',
	'samusoffer_beta',
	'power-rangers',
	'bits-charity',
	'glhf-pledge'
];


export function getBadgeCategory(key) {
	if ( OTHER_BADGES.includes(key) )
		return 'm-other';
	else if ( key.startsWith('overwatch-league') )
		return 'm-owl';
	else if ( key.startsWith('twitchcon') || key.startsWith('glitchcon') )
		return 'm-tcon';
	else if ( /_\d+$/.test(key) )
		return 'm-game';

	return 'm-twitch';
}

export function fixBadgeData(badge) {
	if ( ! badge )
		return badge;

	// Duplicate the badge object, because
	// Apollo results are frozen.
	badge = {...badge};

	// Click Behavior
	if ( ! badge.clickAction && badge.onClickAction )
		badge.clickAction = badge.onClickAction;

	if ( badge.clickAction === 'VISIT_URL' && badge.clickURL )
		badge.click_url = badge.clickURL;

	if ( badge.clickAction === 'TURBO' )
		badge.click_url = 'https://www.twitch.tv/products/turbo?ref=chat_badge';

	if ( badge.clickAction === 'SUBSCRIBE' && badge.channelName )
		badge.click_url = `https://www.twitch.tv/subs/${badge.channelName}`;
	else if ( badge.clickAction )
		badge.click_action = 'sub';

	// Subscriber Tier
	if ( badge.setID === 'subscriber' ) {
		const id = parseInt(badge.version, 10);
		if ( ! isNaN(id) && isFinite(id) ) {
			badge.tier = (id - (id % 1000)) / 1000;
			if ( badge.tier < 0 )
				badge.tier = 0;
		} else
			badge.tier = 0;
	}

	return badge;
}
