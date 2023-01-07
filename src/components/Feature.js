import * as React from "react"

const Feature = (props) => {
  return (
    <div className="col-lg-6 col-md-6">
      <div className="single-feature">
        <div className="feature-icon">
          <img src={props.icon} alt="" />
        </div>
        <div className="feature-content">
          <h4>{props.headline}</h4>
          <p>{props.description}</p>
        </div>
      </div>
    </div>
  )
}

export default Feature;
