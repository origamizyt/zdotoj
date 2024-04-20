import React from 'react';
import ReactDOM from 'react-dom/client';

export function wrapRootElement({ element }) {
    return <>
        <link rel='stylesheet' href='/fonts/RobotoMono.css'/>
        <link rel='stylesheet' href='/fonts/Inter.css'/>
        <style>
            {`
            :root {
                --chakra-fonts-body: 'inter', serif;
                --mono-font: 'Roboto Mono', monospace;
            }
            
            .captcha {
                background-color: #ccc;
                border-radius: 5px;
                cursor: pointer;
            }
            `}
        </style>
        {element}
    </>
}

export function replaceHydrateFunction() {
    return (element, container) => {
        const root = ReactDOM.createRoot(container);
        root.render(element);
    }
}