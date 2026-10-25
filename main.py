from pydantic import BaseModel , Field 
from typing import Literal 
from fastapi import FastAPI
import joblib 
import pandas as pd 
from fastapi.middleware.cors import CORSMiddleware 




app  = FastAPI()


app.add_middleware(
      CORSMiddleware , 
      allow_origins=['*'] , 
      allow_methods=['*'] , 
      allow_headers=['*'] , 
)

@app.get('/')
def greet() : 
    return "Welcome to home page Varun" 


class PredictionResponse(BaseModel) : 
    category : str 
    probs : dict[str , float]


class UserData(BaseModel) : 
    neighbourhood_group : Literal['Manhattan' , 'Brooklyn' , 'Queens' , 'Bronx' , 'Staten Island']
    neighbourhood : str = Field(... ,  min_length=0 , max_length=100 , description='eg Kensington')
    latitude : float = Field(... , gt=-180 , lt=180)
    longitude : float = Field(... , gt=-180 , lt=180)  
    minimum_nights : int = Field(... , gt=0 , le=365)
    number_of_reviews : int = Field(... , gt = -1 )
    reviews_per_month : float = Field(... , gt=0)
    calculated_host_listings_count  : int = Field(... , gt=0)
    availability_365 : int = Field(... ,  gt=-1)
    price : int = Field(... , gt=0) 

model = joblib.load('Model_pipeline.pkl')

@app.post('/predict') 
def predict(data : UserData) : 
    input_row = pd.DataFrame([{
        'neighbourhood_group' : data.neighbourhood_group , 
        'neighbourhood' : data.neighbourhood , 
        'latitude' : data.latitude , 
        'longitude' : data.longitude , 
        'minimum_nights' : data.minimum_nights , 
        'number_of_reviews' : data.number_of_reviews , 
        'reviews_per_month' : data.reviews_per_month , 
        'calculated_host_listings_count' : data.calculated_host_listings_count , 
        'availability_365' : data.availability_365 , 
        'price' : data.price 
    }])

    prediction_category = model.predict(input_row)[0]
    predection_probs = model.predict_proba(input_row)[0] 
    cats = model.classes_
    prediction = {
         'category' : prediction_category , 
         'probs' : {
              cats[0] : round(predection_probs[0] * 100 , 1) , 
              cats[1] : round(predection_probs[1] * 100 , 1) , 
              cats[2] : round(predection_probs[2] * 100 , 1)
         }
    }


    return PredictionResponse(**prediction)