#!/bin/bash

# Better Call Homme - AWS Deployment Script
set -e

# Configuration
ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
STACK_NAME="better-call-homme-${ENVIRONMENT}"

echo "🚀 Deploying Better Call Homme to AWS..."
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "Stack Name: ${STACK_NAME}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install it first."
    exit 1
fi

# Build and push Docker image
echo "📦 Building and pushing Docker image..."

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names better-call-homme --region ${REGION} || \
aws ecr create-repository --repository-name better-call-homme --region ${REGION}

# Get ECR login token
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin \
    ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# Build Docker image
docker build -t better-call-homme .

# Tag and push image
docker tag better-call-homme:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/better-call-homme:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/better-call-homme:latest

echo "✅ Docker image pushed successfully"

# Create AWS Secrets Manager secrets
echo "🔐 Setting up AWS Secrets Manager..."

# Database password
aws secretsmanager create-secret \
    --name "${ENVIRONMENT}/better-call-homme/db-password" \
    --description "Database password for Better Call Homme" \
    --secret-string '{"password":"BetterCallHomme2024!"}' \
    --region ${REGION} || \
aws secretsmanager update-secret \
    --secret-id "${ENVIRONMENT}/better-call-homme/db-password" \
    --secret-string '{"password":"BetterCallHomme2024!"}' \
    --region ${REGION}

# Twilio credentials
aws secretsmanager create-secret \
    --name "${ENVIRONMENT}/better-call-homme/twilio" \
    --description "Twilio credentials for Better Call Homme" \
    --secret-string "{\"account_sid\":\"${TWILIO_ACCOUNT_SID}\",\"auth_token\":\"${TWILIO_AUTH_TOKEN}\",\"phone_number\":\"${TWILIO_PHONE_NUMBER}\"}" \
    --region ${REGION} || \
aws secretsmanager update-secret \
    --secret-id "${ENVIRONMENT}/better-call-homme/twilio" \
    --secret-string "{\"account_sid\":\"${TWILIO_ACCOUNT_SID}\",\"auth_token\":\"${TWILIO_AUTH_TOKEN}\",\"phone_number\":\"${TWILIO_PHONE_NUMBER}\"}" \
    --region ${REGION}

# OpenAI API key
aws secretsmanager create-secret \
    --name "${ENVIRONMENT}/better-call-homme/openai" \
    --description "OpenAI API key for Better Call Homme" \
    --secret-string "{\"api_key\":\"${OPENAI_API_KEY}\"}" \
    --region ${REGION} || \
aws secretsmanager update-secret \
    --secret-id "${ENVIRONMENT}/better-call-homme/openai" \
    --secret-string "{\"api_key\":\"${OPENAI_API_KEY}\"}" \
    --region ${REGION}

echo "✅ Secrets created successfully"

# Deploy CloudFormation stack
echo "☁️ Deploying CloudFormation stack..."

aws cloudformation deploy \
    --template-file aws-deployment.yml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides Environment=${ENVIRONMENT} \
    --capabilities CAPABILITY_NAMED_IAM \
    --region ${REGION}

echo "✅ CloudFormation stack deployed successfully"

# Get stack outputs
echo "📊 Getting stack outputs..."
aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs' \
    --output table

echo "🎉 Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Configure your Twilio phone number webhook to point to:"
echo "   http://$(aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${REGION} --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text)/voice/incoming"
echo ""
echo "2. Set up your Retool dashboard to connect to the API at:"
echo "   http://$(aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${REGION} --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text)/api"
echo ""
echo "3. Test the voice system by calling your Twilio phone number" 