#!/bin/bash

echo "🗄️ Adding PostgreSQL Database to Better Call Homme..."

# Get existing infrastructure details
VPC_ID=$(aws ec2 describe-vpcs --region us-east-1 --filters 'Name=tag:Name,Values=*better-call-homme*' --query 'Vpcs[0].VpcId' --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --region us-east-1 --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')
SECURITY_GROUP=$(aws ec2 describe-security-groups --region us-east-1 --filters "Name=vpc-id,Values=$VPC_ID" "Name=description,Values=*ECS*" --query 'SecurityGroups[0].GroupId' --output text)

echo "🏗️ Infrastructure details:"
echo "VPC: $VPC_ID"
echo "Subnets: $SUBNET_IDS"
echo "Security Group: $SECURITY_GROUP"

# Create database subnet group
echo "📋 Creating database subnet group..."
aws rds create-db-subnet-group \
    --db-subnet-group-name better-call-homme-db-subnet \
    --db-subnet-group-description "Better Call Homme Database Subnet Group" \
    --subnet-ids $SUBNET_IDS \
    --region us-east-1 2>/dev/null || echo "Subnet group already exists"

# Create database security group
echo "🔒 Creating database security group..."
DB_SECURITY_GROUP=$(aws ec2 create-security-group \
    --group-name better-call-homme-db-sg \
    --description "Better Call Homme Database Security Group" \
    --vpc-id $VPC_ID \
    --region us-east-1 \
    --query 'GroupId' \
    --output text 2>/dev/null || aws ec2 describe-security-groups --region us-east-1 --filters "Name=group-name,Values=better-call-homme-db-sg" --query 'SecurityGroups[0].GroupId' --output text)

echo "Database Security Group: $DB_SECURITY_GROUP"

# Add inbound rule for PostgreSQL
aws ec2 authorize-security-group-ingress \
    --group-id $DB_SECURITY_GROUP \
    --protocol tcp \
    --port 5432 \
    --cidr 0.0.0.0/0 \
    --region us-east-1 2>/dev/null || echo "Inbound rule already exists"

# Create RDS instance
echo "🗄️ Creating RDS PostgreSQL instance..."
aws rds create-db-instance \
    --db-instance-identifier better-call-homme-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 14.10 \
    --master-username postgres \
    --master-user-password BetterCallHomme2024! \
    --allocated-storage 20 \
    --storage-type gp2 \
    --db-subnet-group-name better-call-homme-db-subnet \
    --vpc-security-group-ids $DB_SECURITY_GROUP \
    --backup-retention-period 7 \
    --region us-east-1 2>/dev/null || echo "Database instance already exists"

echo "⏳ Waiting for database to be available..."
aws rds wait db-instance-available --db-instance-identifier better-call-homme-db --region us-east-1

# Get database endpoint
DB_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier better-call-homme-db --region us-east-1 --query 'DBInstances[0].Endpoint.Address' --output text)

echo "✅ Database created successfully!"
echo "Database Endpoint: $DB_ENDPOINT"
echo "Database Name: better_call_homme"
echo "Username: postgres"
echo "Password: BetterCallHomme2024!"

# Create secrets in AWS Secrets Manager
echo "🔐 Creating secrets in AWS Secrets Manager..."

# Database password secret
aws secretsmanager create-secret \
    --name better-call-homme-db-password \
    --description "Better Call Homme Database Password" \
    --secret-string "BetterCallHomme2024!" \
    --region us-east-1 2>/dev/null || echo "Database password secret already exists"

# Database connection secret
DB_CONNECTION_STRING="postgresql://postgres:BetterCallHomme2024!@$DB_ENDPOINT:5432/better_call_homme"
aws secretsmanager create-secret \
    --name better-call-homme-db-connection \
    --description "Better Call Homme Database Connection String" \
    --secret-string "$DB_CONNECTION_STRING" \
    --region us-east-1 2>/dev/null || echo "Database connection secret already exists"

echo "✅ Secrets created successfully!"

echo ""
echo "🎯 Next Steps:"
echo "1. Update the ECS task definition with database environment variables"
echo "2. Run database migrations"
echo "3. Test the API endpoints"
echo ""
echo "📊 Database Details:"
echo "Host: $DB_ENDPOINT"
echo "Port: 5432"
echo "Database: better_call_homme"
echo "Username: postgres"
echo "Password: BetterCallHomme2024!" 