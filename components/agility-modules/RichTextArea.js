import React from 'react';
import { renderHTML } from 'agility/utils'
import tw from "twin.macro";

import { Container, ContentWithPaddingLg } from "components/misc/Layouts";
export const RichText = tw.div`prose prose-sm sm:prose lg:prose-lg xl:prose-xl`

const RichTextArea =  (props) => {
	return (
		<Container>
			<ContentWithPaddingLg>
				<h3>{ props.properties.versionID } - {props.syncState.itemToken}</h3>
				<RichText className="prose" dangerouslySetInnerHTML={renderHTML(props.fields.textblob)}></RichText>
			</ContentWithPaddingLg>
		</Container>
	);

}

export default RichTextArea