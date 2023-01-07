import * as React from "react"
import Feature from "./Feature"

const FeaturesSection = (props) => {
  return (
    <section id={props.fields.scroll_anchor_id} className="feature-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-5 col-md-10">
            <div className="section-title mb-60">
              <h2 className="mb-20">{props.fields.headline}</h2>
              <p>{props.fields.subheadline}</p>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="row">
              {props.fields.features.map(feature => <Feature key={feature.headline} {...feature} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection;
