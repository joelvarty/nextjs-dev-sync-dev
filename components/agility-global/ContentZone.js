import React, { Component } from 'react';
import dynamic from 'next/dynamic'


 function ContentZone({ name, page, dynamicPageItem, syncState }) {
	function RenderModules() {

		let modules = page.zones[name];

		const modulesToRender = modules.map(m => {

			let AgilityModule = dynamic(() => import('components/agility-modules/' + m.moduleName + '.js'))

			return <AgilityModule syncState={syncState} key={m.item.contentID} page={page} dynamicPageItem={dynamicPageItem} {...m.item} />
		})

		return modulesToRender;
	}


	return (
		<div>
			<RenderModules />
		</div>
	)
}

export default ContentZone