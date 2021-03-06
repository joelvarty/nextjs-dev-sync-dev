import crypto from 'crypto'
import { asyncForEach } from "./utils"
import GlobalHeader from 'components/agility-global/GlobalHeader'

//Agility API stuff
import { agilityConfig, getSyncClient } from './agility.config'
import GlobalFooter from 'components/agility-global/GlobalFooter'

const securityKey = agilityConfig.securityKey
const channelName = agilityConfig.channelName
const languageCode = agilityConfig.languageCode
const isDevelopmentMode = process.env.NODE_ENV === "development"


export async function getAgilityPageProps({ context, res }) {

	let path = '/';
	if (context.params) {
		//build path by iterating through slugs
		path = '';
		context.params.slug.map(slug => {
			path += '/' + slug
		})
	}

	//determine if we are in preview mode
	const isPreview = (context.preview || isDevelopmentMode);

	const agilitySyncClient = getSyncClient({
		isPreview: isPreview,
		isDevelopmentMode
	});

	//always sync to get latest
	console.log(`Agility CMS => Syncing ${isPreview ? "Preview" : "Live"} Mode`)
	if (! agilitySyncClient) {
		console.log("Agility CMS => Sync client could not be accessed.")
		return {notFound: true};
	}

	await agilitySyncClient.runSync();

	let syncState = await agilitySyncClient.store.getSyncState(agilityConfig.languageCode)

	console.log(`Agility CMS => Getting page props for '${path}'...`);



	//get sitemap
	const sitemap = await agilitySyncClient.store.getSitemap({ channelName, languageCode });

	if (sitemap === null) {
		console.warn("No sitemap found after sync.");
	}

	let pageInSitemap = sitemap[path];
	let page = null;
	let dynamicPageItem = null;

	if (path === '/') {
		let firstPagePathInSitemap = Object.keys(sitemap)[0];
		pageInSitemap = sitemap[firstPagePathInSitemap];
	}

	if (pageInSitemap) {
		//get the page
		page = await agilitySyncClient.store.getPage({
			pageID: pageInSitemap.pageID,
			languageCode: languageCode
		});

	} else {
		//Could not find page
		console.warn('page [' + path + '] not found in sitemap.');
		return handlePageNotFound();
	}

	if (!page) {
		console.warn('page [' + path + '] not found in getpage method.');
	}


	//if there is a dynamic page content id on this page, grab it...
	if (pageInSitemap.contentID > 0) {
		dynamicPageItem = await agilitySyncClient.store.getContentItem({
			contentID: pageInSitemap.contentID,
			languageCode: languageCode
		});
	}

	//resolve the page template
	const pageTemplateName = page.templateName.replace(/[^0-9a-zA-Z]/g, '');

	//resolve the modules per content zone
	await asyncForEach(Object.keys(page.zones), async (zoneName) => {

		let modules = [];

		//grab the modules for this content zone
		const modulesForThisContentZone = page.zones[zoneName];

		//loop through the zone's modules
		await asyncForEach(modulesForThisContentZone, async (moduleItem) => {

			//find the react component to use for the module
			const ModuleComponentToRender = require('components/agility-modules/' + moduleItem.module + '.js').default;

			if (ModuleComponentToRender) {

				//resolve any additional data for the modules
				let moduleData = null;

				if (ModuleComponentToRender.getCustomInitialProps) {
					//we have some additional data in the module we'll need, execute that method now, so it can be included in SSG
					if (isDevelopmentMode) {
						console.log(`Agility CMS => Fetching additional data via getCustomInitialProps for ${moduleItem.module}...`);
					}

					moduleData = await ModuleComponentToRender.getCustomInitialProps({
						item: moduleItem.item,
						agility: agilitySyncClient.store,
						languageCode,
						channelName,
						pageInSitemap,
						dynamicPageItem
					});
				}

				//if we have additional module data, then add it to the module props using 'customData'
				if (moduleData != null) {
					moduleItem.item.customData = moduleData;
				}

				modules.push({
					moduleName: moduleItem.module,
					item: moduleItem.item,

				})

			} else {
				console.error(`No react component found for the module "${moduleItem.module}". Cannot render module.`);
			}
		})


		//store as dictionary
		page.zones[zoneName] = modules;

	})

	//resolve data for other shared components
	const globalHeaderProps = await GlobalHeader.getCustomInitialProps({ agility: agilitySyncClient.store, languageCode: languageCode, channelName: channelName });
	const globalFooterProps = await GlobalFooter.getCustomInitialProps({ agility: agilitySyncClient.store, languageCode: languageCode, channelName: channelName });

	return {
		syncState,
		sitemapNode: pageInSitemap,
		page,
		dynamicPageItem,
		pageTemplateName,
		globalHeaderProps,
		globalFooterProps,
		languageCode,
		channelName,
		isPreview,
		isDevelopmentMode
	}
}

export async function getAgilityPaths() {

	console.log(`Agility CMS => Fetching sitemap for getAgilityPaths...`);

	//determine if we are in preview mode
	const isPreview = isDevelopmentMode;

	const agilitySyncClient = getSyncClient({
		isPreview,
		isDevelopmentMode
	});

	//always sync to get latest
	console.log(`Agility CMS => Syncing ${isPreview ? "Preview" : "Live"} Mode`)
	if (! agilitySyncClient) {
		console.log("Agility CMS => Sync client could not be accessed.")
		return [];
	}
	await agilitySyncClient.runSync();


	const sitemapFlat = await agilitySyncClient.store.getSitemap({
		channelName,
		languageCode
	})


	if (!sitemapFlat) {
		console.warn("Agility CMS => No Site map found.  Make sure your environment variables are setup correctly.")
		return []
	}

	const paths = Object.keys(sitemapFlat).map(s => {
		//returns an array of paths as a string (i.e.  ['/home', '/posts'] as opposed to [{ params: { slug: 'home'}}]))
		return s;
	})

	return paths
}


export async function validatePreview({ agilityPreviewKey, slug }) {
	//Validate the preview key
	if (!agilityPreviewKey) {
		return {
			error: true,
			message: `Missing agilitypreviewkey.`
		}
	}

	//sanitize incoming key (replace spaces with '+')
	if (agilityPreviewKey.indexOf(` `) > -1) {
		agilityPreviewKey = agilityPreviewKey.split(` `).join(`+`);
	}

	//compare the preview key being used
	const correctPreviewKey = generatePreviewKey();

	if (agilityPreviewKey !== correctPreviewKey) {
		return {
			error: true,
			message: `Invalid agilitypreviewkey.`
			//message: `Invalid agilitypreviewkey. Incoming key is=${agilityPreviewKey} compared to=${correctPreviewKey}...`
		}
	}

	//return success
	return {
		error: false,
		message: null
	}

}

export function generatePreviewKey() {
	//the string we want to encode
	const str = `-1_${securityKey}_Preview`;

	//build our byte array
	let data = [];
	for (var i = 0; i < str.length; ++i) {
		data.push(str.charCodeAt(i));
		data.push(0);
	}

	//convert byte array to buffer
	const strBuffer = Buffer.from(data);

	//encode it!
	const previewKey = crypto.createHash('sha512').update(strBuffer).digest('base64');
	return previewKey;
}

function handlePageNotFound() {
	return {
		notFound: true
	}
}

