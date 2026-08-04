// ------------------------------------------------------------------
//  FERN LOOP INTERPRETIVE WAYPOINTS — informational, NOT collectable.
//  These are the 13 numbered nature-trail stations along Fern Loop /
//  Brandywine, adapted from the August 1997 Palisades Park Country
//  Club guide (dedicated to Jack Gardner). Each has a permanent place
//  ID (p0019–p0031) printed as a QR deep link on the physical sign:
//  https://palisadestrails.com/?p={placeId}
//  Place IDs are immutable and never reused; display numbers, titles,
//  coordinates, and text may change without changing the ID.
//  Source of truth: docs/fern-loop-interpretive-guide-final.md
// ------------------------------------------------------------------

export interface FernLoopWaypoint {
	/** Permanent place ID (`p0019`–`p0031`) — matches the printed QR signs. */
	placeId: string;
	/** Display number on the physical sign (1–13). May be renumbered. */
	number: number;
	title: string;
	lat: number;
	lon: number;
	/** Interpretive text, one entry per paragraph. */
	paragraphs: string[];
}

export const FERN_LOOP_WAYPOINTS: FernLoopWaypoint[] = [
	{
		placeId: 'p0019',
		number: 1,
		title: 'Floodplain / Brandywine',
		lat: 42.3142,
		lon: -86.31475,
		paragraphs: [
			'Fern Loop Trail, along the four-mile Brandywine, is a floodplain. The creek gets its copper color from tannic acid in decayed oak leaves. Bracken Fern helps stabilize upland dunes. Greenbrier, an evergreen climbing vine with many curly tendrils and thorns, is plentiful.',
			'Along the trail, True Solomon’s-seal flowers and berries dangle from the leaf axils. Canada Mayflower, also called Wild Lily-of-the-Valley, shows up occasionally. A different, non-native Lily-of-the-Valley is found in abundance around park cottages.',
			'There is a large Beech tree behind the box. As you look into any Beech–Maple woods, the Beech’s smooth gray bark, gentle curves of the trunk, and massive appearance look like elephant legs, with exposed roots resembling feet.',
			'Behind you on the creek bank is a mature Tulip Poplar, with younger trees near the bridge. West of the bridge is a cluster of Hemlocks. The small, one-inch cones grow from the ends of the twigs. The needles are flat and dark green, with a white stripe beneath.',
			'Begin the trail by heading upstream toward Waypoint 2.',
		],
	},
	{
		placeId: 'p0020',
		number: 2,
		title: 'Fern Loop Entrance / Sassafras',
		lat: 42.31416,
		lon: -86.31437,
		paragraphs: [
			'You are at the entrance to Fern Loop, where the trail sign is attached to a Sassafras snag.',
			'Fallen trees in the stream stabilize the banks, slow the water flow, and provide cover for trout and salmon. Invasive, non-native Barberry shrubs and native Mapleleaf Viburnum border the trail ahead. Feel the velvet texture of the Viburnum leaves.',
			'The Barberry has stiff, small, half-inch-long, pear-shaped leaves and shiny green berries that turn bright red in fall. It is a favorite plant for ticks to overwinter in and should be eradicated.',
			'A taller shrub is Witch-hazel, a multi stemmed plant with scalloped, lopsided leaves. An aromatic extract of the leaves, twigs, and bark is used as a mild astringent.',
			'You will see a Red Maple here, marked with a yellow blaze. A native Grape Vine is reaching toward the sun—phototropism—on a snag to the north.',
		],
	},
	{
		placeId: 'p0021',
		number: 3,
		title: 'White Pine / Oaks',
		lat: 42.31451,
		lon: -86.31421,
		paragraphs: [
			'A very large White Pine, Michigan’s state tree, has fallen here. Decaying fallen trees are vital for wildlife habitat, nutrient cycling, and nurse logs.',
			'Note the large Red Oak at right. The gray “ski tracks”—distinct vertical stripes on the bark—are a reliable field mark. You might find oak insect galls on the ground below. They are about the size and weight of a ping-pong ball.',
			'You may observe American Cancer-root, a parasitic plant that grows only on oaks. Oaks are in the Beech family. There are two main families of oaks: red oaks and white oaks. The red group has pointed-tipped, shiny leaves, while the white group has round-tipped leaves with a duller finish. Each oak has acorns that vary in shape and size.',
			'There is a Witch-hazel to the left of the Red Oak. Note the Beech upstarts and their paper-feeling leaves with parallel veins.',
		],
	},
	{
		placeId: 'p0022',
		number: 4,
		title: 'Oxbow',
		lat: 42.3146,
		lon: -86.31405,
		paragraphs: [
			'The curved depression here is an old oxbow wetland. Oxbows are formed when streams change course, and they mitigate flooding during heavy rains.',
			'There are large Royal Ferns at the end of the oxbow. Dead trees, or snags, are important habitat for many birds. Look around and you will see large, squarish holes in the snags. Pileated Woodpeckers excavate these while looking for food. Other birds and mammals use the holes later.',
		],
	},
	{
		placeId: 'p0023',
		number: 5,
		title: 'Beech–Maple Woods / Climax Forest',
		lat: 42.31474,
		lon: -86.31392,
		paragraphs: [
			'This is a Beech–Maple woods. The other dominant woodland ecosystem in southwest Michigan is Oak–Hickory. Both are climax forests, the final stage of the ecological succession process.',
			'Look north, where you are facing a dune hill with towering Red Oaks like Greek columns. In front of you are scattered White Pines. White Pines add a new row, or layer, of branches each year. That makes it easy to observe the amount of growth per year. This pine is one of three native pines in Michigan; the other two are Jack Pine and Red Pine.',
			'Just behind is a huge Red Oak with a yellow blaze. Give it a hug and feel its might and many years of enduring nature’s powerful forces. Sometimes the loose sand gives way and the mighty oak tumbles.',
			'Walk between two large oaks toward Waypoint 6, and look up, up, up to see the pointed-lobed leaves.',
		],
	},
	{
		placeId: 'p0024',
		number: 6,
		title: 'Sassafras',
		lat: 42.31475,
		lon: -86.31338,
		paragraphs: [
			'Just beyond the waypoint is a large Sassafras with a natural split about 35 feet up. It has deeply furrowed, soft-looking, reddish-brown bark.',
			'The leaves of Sassafras are special: four shapes of “mittens”—two-thumbed, thumbs left and right, and no thumb. The roots and bark supply oil of Sassafras, used to perfume soap, make Sassafras tea, and flavor root beer.',
			'The brilliant orange hues make it a favorite tree for fall color. Sassafras spreads by ramets, or underground stems, as anyone who has cut down a Sassafras will discover. It is the host plant for several Swallowtail butterfly species and the Promethea Moth.',
		],
	},
	{
		placeId: 'p0025',
		number: 7,
		title: 'Tulip Trees (Yellow Poplar)',
		lat: 42.3149,
		lon: -86.31321,
		paragraphs: [
			'A stand of Tulip Trees has been spawned here by the giant mother tree at your right. Also known as Yellow Poplar, this is often the tallest tree in the forest.',
			'Note the straight trunk and symmetrically arranged bark furrows. The leaves have the profile shape of a tulip. The beautiful orange-and-yellow spring flowers also resemble tulips.',
			'It is the only member of the Magnolia family native to Michigan. It is host to the Eastern Tiger Swallowtail butterfly and the large Tuliptree Silkmoth.',
			'Partridgeberry, a prostrate woody shrub, is the evergreen ground plant here.',
		],
	},
	{
		placeId: 'p0026',
		number: 8,
		title: 'Hemlock / Red Maple',
		lat: 42.31473,
		lon: -86.31309,
		paragraphs: [
			'Here is a medium-sized Hemlock tree. We are at the southernmost edge of where Hemlocks grow, so expect that they will eventually die out as the climate warms.',
			'An additional stressor is the Hemlock Woolly Adelgid, an invasive, sap-sucking pest that the Michigan Department of Natural Resources actively monitors.',
			'Socrates did not drink sap from this tree in his suicide. There is a wetland plant, Water Hemlock, growing three to six feet high that contains the poison potion Socrates drank. There’s no Water Hemlock on this trail.',
			'Note the trifurcated Red Maple clump on the right. Red Maple leaves are saw-toothed, while Sugar Maple leaves are not. A Witch-hazel shrub canopy hovers over the trail as you proceed toward Waypoint 9.',
		],
	},
	{
		placeId: 'p0027',
		number: 9,
		title: 'Creek / Stream',
		lat: 42.31427,
		lon: -86.31217,
		paragraphs: [
			'From spring through fall, you will see a variety of mushrooms in the woods. Mushrooms provide food for deer, small mammals, insects, Box Turtles, and Wild Turkeys.',
			'Mapleleaf Viburnums grow along the banks. The berries are food for many mammals and birds.',
			'Stop and listen. You may hear a Red-eyed Vireo or Acadian Flycatcher, or spot a Great Blue Heron in the stream.',
		],
	},
	{
		placeId: 'p0028',
		number: 10,
		title: 'Sassafras / Wood Sedge',
		lat: 42.31421,
		lon: -86.31237,
		paragraphs: [
			'This section of trail has many Sassafras trees. By now, you will easily recognize the bark of the larger ones. Small Sassafras trees show a lot of bright green on their twigs. American Indians called this tree “greenstick” for this reason.',
			'You will enjoy breaking off a leaf and twig, briskly rubbing them until damp, and then sniffing. You will get the aroma of Sassafras tea.',
			'A Red Maple stands at the upper left of the waypoint. There are a few clumps of Wood Sedge, a grassy-looking plant, at its base. There are more than 250 species of sedges in Michigan. You can tell them from grasses by their solid, triangular stems: “sedges have edges.”',
		],
	},
	{
		placeId: 'p0029',
		number: 11,
		title: 'Poison Ivy / Sugar Maple',
		lat: 42.31414,
		lon: -86.31253,
		paragraphs: [
			'Poison Ivy should be learned early. It grows throughout most of the United States. Here it is, although small, at the base of the waypoint.',
			'While it has three leaves and grows as a vine, it does not have sawteeth. It has a particular notch just behind the leaf tip on one side. That is a key field mark.',
			'Touching any part of the plant, or breathing fine particles produced by mowing or burning it, can cause a blistering reaction. After contact, wash with strong soap or detergent as soon as possible.',
			'There is a large Sugar Maple toward the Brandywine. Palisades has many, but most are outside the floodplain area. The leaves have smooth edges and five lobes. This maple has a high sugar content in its sap, making it best for maple syrup production.',
			'Older trunks have flat plates of bark, rather than the scaly bark of mature Silver and Red Maples. The two connected, winged seeds, or samaras, are horseshoe-shaped rather than A-frame-shaped like those of Silver and Red Maples.',
			'A finely textured sedge, Pennsylvania Sedge, grows along the path here.',
		],
	},
	{
		placeId: 'p0030',
		number: 12,
		title: 'Basswood / Virginia Creeper',
		lat: 42.31401,
		lon: -86.31324,
		paragraphs: [
			'You may be able to spot an American Basswood hanging over the stream on the opposite bank to the left. Its yellowish-white flowers and bracts make it easy to identify in summer.',
			'Look for Virginia Creeper, also known as Woodvine or Woodbine, a common vine that provides berries and cover for forest creatures. Its five sawtoothed leaves are easily mistaken for the three leaves of Poison Ivy.',
			'Virginia Creeper is brilliant red in autumn and will grow on the ground or up trees, poles, and buildings. It adds to the beauty of the forest.',
			'As you walk toward the next waypoint, stop and smell the Northern Spicebush. Crush a leaf with your fingers to release its fragrance. Female shrubs have bright red berries in fall and tiny, bright yellow flowers in early spring. Spicebush is an essential host plant for the Spicebush Swallowtail.',
		],
	},
	{
		placeId: 'p0031',
		number: 13,
		title: 'Hog-peanut / Small White Pines',
		lat: 42.31388,
		lon: -86.3134,
		paragraphs: [
			'The American Hog-peanut, or Ground Bean vine, is a native legume abundant at this waypoint. It has three leaflets and gets its name from underground seeds, apparently favored by hogs.',
			'Small mammals and ground birds eat the seeds as well. It produces both aboveground and underground flowers, a strategy called amphicarpy. It is a host for the Silver-spotted Skipper and Northern Cloudywing butterflies.',
			'There are a few small White Pines. White Pines have five needles per cluster, an easy identification mark.',
			'Continue along the Brandywine bank trail toward the bridge.',
		],
	},
];
